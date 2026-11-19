/**
 * Calendrier des lancements spatiaux — API Launch Library 2 de The Space Devs.
 * Analyse défensive des réponses, cache hors-ligne 6 h (périmé lisible en
 * secours) et jeu embarqué si l'API n'a jamais été joignable.
 */
import { BUNDLED_LAUNCHES_FETCHED_AT, BUNDLED_LAUNCHES_RAW } from '../../data/launchesFallback.generated'
import type { Launch, LaunchSet, LaunchStatus, Ll2LaunchRaw } from '../../types/space'
import { cachedFetch } from '../cache'

export const LL2_UPCOMING_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/'
export const LAUNCHES_TTL_MS = 6 * 3_600_000
const CACHE_KEY = 'launches:upcoming'
const FETCH_TIMEOUT_MS = 12_000
export const LAUNCH_PAGE_SIZE = 30

export class LaunchParseError extends Error {}

const STATUS_BY_ABBREV: Readonly<Record<string, LaunchStatus>> = {
  go: 'go',
  tbc: 'tbc',
  tbd: 'tbd',
  hold: 'hold',
  'in flight': 'in-flight',
  success: 'success',
  failure: 'failure',
  'partial failure': 'partial-failure',
}

export const LAUNCH_STATUS_FR: Readonly<Record<LaunchStatus, string>> = {
  go: 'Go',
  tbc: 'À confirmer',
  tbd: 'Date indéterminée',
  hold: 'Suspendu',
  'in-flight': 'En vol',
  success: 'Réussi',
  failure: 'Échec',
  'partial-failure': 'Échec partiel',
  unknown: 'Statut inconnu',
}

export function launchStatusOf(abbrev: string | undefined): LaunchStatus {
  return STATUS_BY_ABBREV[(abbrev ?? '').trim().toLowerCase()] ?? 'unknown'
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
/** Valeurs génériques de Launch Library 2 (« Unknown », « Details TBD. ») traitées comme absentes. */
const info = (v: unknown): string | null => {
  const s = str(v)
  return s && !/^(unknown|n\/a|tbd|details tbd\.?)$/i.test(s) ? s : null
}
/**
 * Remplace les mentions brutes « TBD » / « TBD? » de Launch Library 2 par
 * « À confirmer » : « SatNet LEO Group TBD? » → « SatNet LEO Group · À confirmer ».
 */
export function humanizeTbd(s: string): string {
  if (/^unknown payload$/i.test(s.trim())) return 'Charge utile non divulguée'
  const out = s.replace(/\s*\bTBD\b\??/gi, ' · À confirmer').replace(/^\s*·\s*/, '').replace(/\s*·\s*·\s*/g, ' · ').trim()
  return out || 'À confirmer'
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const date = (v: unknown): Date | null => {
  const s = str(v)
  const ms = s ? Date.parse(s) : NaN
  return Number.isFinite(ms) ? new Date(ms) : null
}

/** Normalise un lancement brut ; `null` s'il manque l'identifiant, le nom ou la date NET. */
export function parseLaunch(raw: Ll2LaunchRaw): Launch | null {
  const id = str(raw.id)
  const rawName = str(raw.name)
  const name = rawName && humanizeTbd(rawName)
  const net = date(raw.net)
  if (!id || !name || !net) return null
  const status = launchStatusOf(raw.status?.abbrev)
  const cfg = raw.rocket?.configuration
  const [rocketPart, missionPart] = name.split(' | ')
  const precision = str(raw.net_precision?.name)
  return {
    id,
    name,
    missionName: humanizeTbd(str(raw.mission?.name) ?? missionPart ?? name),
    missionDescription: info(raw.mission?.description),
    missionType: info(raw.mission?.type),
    orbit: info(raw.mission?.orbit?.name),
    net,
    netPrecision: precision && !/^second$/i.test(precision) ? precision : null,
    windowStart: date(raw.window_start),
    windowEnd: date(raw.window_end),
    status,
    statusLabel: LAUNCH_STATUS_FR[status],
    statusDescription: str(raw.status?.description),
    provider: str(raw.launch_service_provider?.name) ?? 'Opérateur inconnu',
    rocket: humanizeTbd(str(cfg?.full_name) ?? str(cfg?.name) ?? rocketPart ?? 'Lanceur inconnu'),
    rocketFamily: str(cfg?.family),
    pad: humanizeTbd(str(raw.pad?.name) ?? 'Pas de tir inconnu'),
    location: str(raw.pad?.location?.name) ?? '',
    countryCode: str(raw.pad?.location?.country_code),
    padLatitudeDeg: num(raw.pad?.latitude),
    padLongitudeDeg: num(raw.pad?.longitude),
    probabilityPct: num(raw.probability),
    holdReason: str(raw.holdreason),
    imageUrl: str(raw.image),
    webcastLive: raw.webcast_live === true,
  }
}

/** Analyse une réponse paginée `{ results: [...] }` ; lève si la structure est invalide. */
export function parseLaunchResponse(json: unknown): Launch[] {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results)) throw new LaunchParseError('Réponse Launch Library 2 sans « results »')
  return results
    .map((r) => (r && typeof r === 'object' ? parseLaunch(r as Ll2LaunchRaw) : null))
    .filter((l): l is Launch => l !== null)
    .sort((a, b) => a.net.getTime() - b.net.getTime())
}

/** Jeu de lancements embarqué (relevé réel, analysé comme une réponse réseau). */
export function bundledLaunches(): Launch[] {
  return parseLaunchResponse({ results: BUNDLED_LAUNCHES_RAW })
}

// Les lancements sont mis en cache sous forme brute (JSON) : les dates sont reconstruites à la lecture.
type CachedLaunch = Omit<Launch, 'net' | 'windowStart' | 'windowEnd'> & { net: string; windowStart: string | null; windowEnd: string | null }
const toCached = (l: Launch): CachedLaunch => ({ ...l, net: l.net.toISOString(), windowStart: l.windowStart?.toISOString() ?? null, windowEnd: l.windowEnd?.toISOString() ?? null })
const fromCached = (c: CachedLaunch): Launch => ({ ...c, net: new Date(c.net), windowStart: c.windowStart ? new Date(c.windowStart) : null, windowEnd: c.windowEnd ? new Date(c.windowEnd) : null })

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Launch Library 2 HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Prochains lancements : cache valide (6 h), sinon réseau, sinon cache périmé,
 * sinon données embarquées. Ne lève jamais.
 */
export async function loadLaunches(options: { force?: boolean; fetchImpl?: typeof fetch; nowMs?: number } = {}): Promise<LaunchSet> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const url = `${LL2_UPCOMING_URL}?limit=${LAUNCH_PAGE_SIZE}&mode=normal&hide_recent_previous=true`
  try {
    const res = await cachedFetch<CachedLaunch[]>(
      CACHE_KEY,
      LAUNCHES_TTL_MS,
      async () => {
        const launches = parseLaunchResponse(await fetchJson(url, fetchImpl))
        if (launches.length === 0) throw new LaunchParseError('Aucun lancement exploitable')
        return launches.map(toCached)
      },
      { force: options.force, nowMs: options.nowMs },
    )
    return { launches: res.value.map(fromCached), fetchedAt: res.storedAt, origin: res.origin }
  } catch {
    return { launches: bundledLaunches(), fetchedAt: BUNDLED_LAUNCHES_FETCHED_AT, origin: 'bundled' }
  }
}

/**
 * Lancements à afficher à l'instant simulé `nowMs` : à venir, ou partis depuis
 * moins de `recentMs` (affichés en T+). Ordre chronologique.
 */
export function upcomingLaunches(launches: readonly Launch[], nowMs: number, recentMs = 3_600_000): Launch[] {
  return launches.filter((l) => l.net.getTime() >= nowMs - recentMs)
}
