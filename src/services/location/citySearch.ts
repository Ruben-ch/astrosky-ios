/**
 * Recherche de villes pour le sélecteur de lieu.
 * - Hors-ligne : catalogue GeoNames embarqué (chargé à la demande, chunk séparé).
 * - En ligne : API de géocodage Open-Meteo (sans clé), cache 30 jours par requête.
 * Les deux sources partagent les identifiants GeoNames, ce qui permet la fusion.
 */
import type { ObserverLocation } from '../../types/astro'
import type { CityResult, CitySearchResponse } from '../../types/location'
import { cachedFetch } from '../cache'
import { countryNameFr, haversineKm, normalizeText } from './geodesy'

export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
export const GEOCODING_TTL_MS = 30 * 86_400_000
const GEOCODING_TIMEOUT_MS = 6_000
export const MIN_QUERY_LENGTH = 2

type CityRow = readonly [number, string, string, number, number, number, number, number]

export interface CityCatalog {
  readonly rows: readonly CityRow[]
  readonly regions: readonly string[]
  /** Nom normalisé de chaque ligne (même index que `rows`). */
  readonly normalized: readonly string[]
}

let catalogPromise: Promise<CityCatalog> | null = null

/** Construit l'index de recherche d'un catalogue brut. */
export function buildCityCatalog(rows: readonly CityRow[], regions: readonly string[]): CityCatalog {
  return { rows, regions, normalized: rows.map((r) => normalizeText(r[1])) }
}

/** Charge (une seule fois) le catalogue embarqué. */
export function loadCityCatalog(): Promise<CityCatalog> {
  catalogPromise ??= import('../../data/cities.generated').then((m) => buildCityCatalog(m.CITY_ROWS, m.CITY_REGIONS))
  return catalogPromise
}

function rowToCity(row: CityRow, regions: readonly string[]): CityResult {
  const [id, name, cc, regionIdx, latitudeDeg, longitudeDeg, elevationM, population] = row
  return {
    id: `geonames:${id}`, name, countryCode: cc, country: countryNameFr(cc), region: regions[regionIdx] ?? '',
    population, latitudeDeg, longitudeDeg, elevationM, source: 'offline',
  }
}

/**
 * Pertinence d'un nom pour une requête normalisée : 4 = exact, 3 = préfixe,
 * 2 = préfixe d'un mot, 1 = sous-chaîne, 0 = absent.
 */
export function matchRank(nameNorm: string, queryNorm: string): number {
  if (!queryNorm) return 0
  if (nameNorm === queryNorm) return 4
  if (nameNorm.startsWith(queryNorm)) return 3
  if (nameNorm.split(' ').some((w) => w.startsWith(queryNorm))) return 2
  return nameNorm.includes(queryNorm) ? 1 : 0
}

/** Recherche dans le catalogue embarqué, triée par pertinence puis population. */
export function searchOffline(catalog: CityCatalog, query: string, limit = 12): CityResult[] {
  const q = normalizeText(query)
  if (q.length < MIN_QUERY_LENGTH) return []
  const hits: { i: number; rank: number }[] = []
  for (let i = 0; i < catalog.rows.length; i++) {
    const rank = matchRank(catalog.normalized[i], q)
    if (rank > 0) hits.push({ i, rank })
  }
  // Les lignes sont déjà triées par population décroissante : tri stable sur le rang.
  hits.sort((a, b) => b.rank - a.rank || a.i - b.i)
  return hits.slice(0, limit).map((h) => rowToCity(catalog.rows[h.i], catalog.regions))
}

/** Ville du catalogue la plus proche (pour nommer une position GPS hors-ligne). */
export function nearestCity(catalog: CityCatalog, loc: Pick<ObserverLocation, 'latitudeDeg' | 'longitudeDeg'>): { city: CityResult; distanceKm: number } | null {
  let best = -1
  let bestKm = Infinity
  for (let i = 0; i < catalog.rows.length; i++) {
    const r = catalog.rows[i]
    // Pré-filtre grossier (±3° en latitude) avant le calcul exact.
    if (Math.abs(r[4] - loc.latitudeDeg) > 3) continue
    const km = haversineKm(loc, { latitudeDeg: r[4], longitudeDeg: r[5] })
    if (km < bestKm) {
      bestKm = km
      best = i
    }
  }
  return best < 0 ? null : { city: rowToCity(catalog.rows[best], catalog.regions), distanceKm: bestKm }
}

// ─── Open-Meteo ────────────────────────────────────────────────────────
export interface GeocodingResponse {
  results?: {
    id: number
    name: string
    latitude: number
    longitude: number
    elevation?: number
    country_code?: string
    country?: string
    admin1?: string
    population?: number
  }[]
}

export function buildGeocodingUrl(query: string, count = 10): string {
  const params = new URLSearchParams({ name: query.trim(), count: String(count), language: 'fr', format: 'json' })
  return `${GEOCODING_URL}?${params.toString()}`
}

/** Convertit la réponse Open-Meteo en résultats typés (entrées invalides ignorées). */
export function parseGeocoding(json: GeocodingResponse): CityResult[] {
  const out: CityResult[] = []
  for (const r of json.results ?? []) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) || !r.name) continue
    const cc = (r.country_code ?? '').toUpperCase()
    out.push({
      id: `geonames:${r.id}`, name: r.name, countryCode: cc, country: r.country ?? (cc ? countryNameFr(cc) : ''),
      region: r.admin1 ?? '', population: r.population ?? 0, latitudeDeg: r.latitude, longitudeDeg: r.longitude,
      elevationM: Number.isFinite(r.elevation) ? Math.round(r.elevation!) : 0, source: 'online',
    })
  }
  return out
}

async function fetchGeocoding(query: string, fetchImpl: typeof fetch): Promise<GeocodingResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), GEOCODING_TIMEOUT_MS)
  try {
    const res = await fetchImpl(buildGeocodingUrl(query), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Géocodage HTTP ${res.status}`)
    return (await res.json()) as GeocodingResponse
  } finally {
    clearTimeout(timer)
  }
}

export async function searchOnline(query: string, fetchImpl: typeof fetch): Promise<CityResult[]> {
  const key = `geocode:${normalizeText(query)}`
  const res = await cachedFetch(key, GEOCODING_TTL_MS, () => fetchGeocoding(query, fetchImpl))
  return parseGeocoding(res.value)
}

/** Fusionne deux listes : en ligne d'abord, doublons (même id ou même nom à < 5 km) écartés. */
export function mergeCityResults(online: readonly CityResult[], offline: readonly CityResult[], limit = 12): CityResult[] {
  const out: CityResult[] = [...online]
  for (const c of offline) {
    const dup = out.some((o) => o.id === c.id || (normalizeText(o.name) === normalizeText(c.name) && haversineKm(o, c) < 5))
    if (!dup) out.push(c)
  }
  return out.slice(0, limit)
}

/** Recherche complète : catalogue embarqué toujours, Open-Meteo si joignable. */
export async function searchCities(
  query: string,
  options: { fetchImpl?: typeof fetch; catalog?: CityCatalog; limit?: number } = {},
): Promise<CitySearchResponse> {
  const limit = options.limit ?? 12
  if (normalizeText(query).length < MIN_QUERY_LENGTH) return { query, results: [], mode: 'offline' }
  const catalog = options.catalog ?? (await loadCityCatalog())
  const offline = searchOffline(catalog, query, limit)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) return { query, results: offline, mode: 'offline' }
  try {
    const online = await searchOnline(query, fetchImpl)
    return { query, results: mergeCityResults(online, offline, limit), mode: 'online' }
  } catch {
    return { query, results: offline, mode: 'offline' }
  }
}

/** Libellé secondaire « Région, Pays » sans doublon. */
export function cityDetail(c: Pick<CityResult, 'region' | 'country' | 'name'>): string {
  return [c.region, c.country].filter((s, i, a) => s && s !== c.name && a.indexOf(s) === i).join(', ')
}
