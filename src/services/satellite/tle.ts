/**
 * Éléments orbitaux à deux lignes (TLE) : analyse, validation de la somme de
 * contrôle, téléchargement CelesTrak, cache 12 h et secours embarqué hors-ligne.
 */
import { BRIGHT_SATELLITE_TLES, BRIGHT_TLE_FETCHED_AT } from '../../data/brightSatellites.generated'
import { BUNDLED_TLE_FETCHED_AT, BUNDLED_TLES as STATION_TLES } from '../../data/tleFallback.generated'
import type { TleRecord, TleSet } from '../../types/services'
import { cachedFetch } from '../cache'

export const CELESTRAK_GP_URL = 'https://celestrak.org/NORAD/elements/gp.php'
export const TLE_TTL_MS = 12 * 3_600_000
const FETCH_TIMEOUT_MS = 10_000

/** Satellites suivis par défaut : ISS, station chinoise Tiangong, télescope Hubble. */
export const DEFAULT_TRACKED_NORAD_IDS: readonly number[] = [25544, 48274, 20580]

export class TleParseError extends Error {}

/** Garde, pour chaque numéro NORAD, les éléments à l'époque la plus récente. */
export function mergeTleRecords(...lists: readonly (readonly TleRecord[])[]): TleRecord[] {
  const byId = new Map<number, TleRecord>()
  for (const r of lists.flat()) {
    const prev = byId.get(r.noradId)
    if (!prev || tleEpoch(r) > tleEpoch(prev)) byId.set(r.noradId, r)
  }
  return [...byId.values()]
}

/** Secours embarqué : stations (ISS, Tiangong, Hubble) + satellites brillants en orbite basse. */
export const BUNDLED_TLES: readonly TleRecord[] = mergeTleRecords(STATION_TLES, BRIGHT_SATELLITE_TLES)
const BUNDLED_FETCHED_AT = Math.min(BUNDLED_TLE_FETCHED_AT, BRIGHT_TLE_FETCHED_AT)

let lastSet: readonly TleRecord[] = BUNDLED_TLES

/** Mémorise le dernier jeu chargé (consulté par le planétarium pour guider vers un satellite). */
export function rememberTleSet(set: TleSet): void {
  lastSet = mergeTleRecords(BUNDLED_TLES, set.records)
}

/** Éléments d'un satellite : dernier jeu chargé, sinon secours embarqué. */
export function findTleRecord(noradId: number): TleRecord | undefined {
  return lastSet.find((r) => r.noradId === noradId) ?? BUNDLED_TLES.find((r) => r.noradId === noradId)
}

/** Somme de contrôle modulo 10 d'une ligne TLE (chiffres + 1 par signe « − »). */
export function tleChecksum(line: string): number {
  let sum = 0
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += ch.charCodeAt(0) - 48
    else if (ch === '-') sum += 1
  }
  return sum % 10
}

export function isTleLineValid(line: string, lineNumber: 1 | 2): boolean {
  return line.length >= 69 && line[0] === String(lineNumber) && tleChecksum(line) === Number(line[68])
}

/** Analyse un texte TLE au format 3 lignes (nom + 2 lignes). Ignore les blocs invalides. */
export function parseTleText(text: string): TleRecord[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0)
  const out: TleRecord[] = []
  let i = 0
  while (i + 2 < lines.length) {
    const [name, line1, line2] = [lines[i].trim(), lines[i + 1], lines[i + 2]]
    if (isTleLineValid(line1, 1) && isTleLineValid(line2, 2) && line1.slice(2, 7) === line2.slice(2, 7)) {
      out.push({ name, noradId: Number(line1.slice(2, 7)), line1, line2 })
      i += 3
    } else {
      i += 1 // resynchronisation sur le bloc suivant
    }
  }
  return out
}

/** Époque des éléments (UTC) déduite des colonnes 19–32 de la ligne 1. */
export function tleEpoch(record: TleRecord): Date {
  const yy = Number(record.line1.slice(18, 20))
  const dayOfYear = Number(record.line1.slice(20, 32))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return new Date(Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000)
}

/** Âge des éléments par rapport à `date`, en jours (précision SGP4 ≈ 1–3 km/jour). */
export function tleAgeDays(record: TleRecord, date: Date): number {
  return (date.getTime() - tleEpoch(record).getTime()) / 86_400_000
}

/**
 * Demi-fenêtre de validité des éléments, en jours. Au-delà, l'erreur SGP4 d'une
 * orbite basse (traînée, manœuvres) dépasse largement le champ de vue : position
 * et passages deviendraient fictifs, ils sont donc masqués.
 */
export const TLE_VALIDITY_DAYS = 30

/** Message affiché lorsque l'instant simulé sort de la fenêtre de validité. */
export const TLE_VALIDITY_MESSAGE = `Prédictions orbitales limitées à ±${TLE_VALIDITY_DAYS} jours autour de la date des données TLE`

/** Les éléments sont-ils exploitables à `date` (|âge| ≤ 30 j) ? */
export function isTleValidAt(record: TleRecord, date: Date): boolean {
  return Math.abs(tleAgeDays(record, date)) <= TLE_VALIDITY_DAYS
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Charge un groupe CelesTrak (par défaut « visual », les ~150 satellites les plus
 * brillants dont l'ISS, Tiangong et Hubble). Repli : cache périmé, puis TLE embarqués.
 */
export async function loadTleSet(
  options: { group?: string; force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<TleSet> {
  const group = options.group ?? 'visual'
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  try {
    const res = await cachedFetch<TleRecord[]>(`tle:${group}`, TLE_TTL_MS, async () => {
      const records = parseTleText(await fetchText(`${CELESTRAK_GP_URL}?GROUP=${encodeURIComponent(group)}&FORMAT=tle`, fetchImpl))
      if (records.length === 0) throw new TleParseError('Réponse CelesTrak sans TLE valide')
      return records
    }, { force: options.force })
    const set: TleSet = { records: res.value, fetchedAt: res.storedAt, origin: res.origin }
    rememberTleSet(set)
    return set
  } catch {
    return { records: BUNDLED_TLES, fetchedAt: BUNDLED_FETCHED_AT, origin: 'bundled' }
  }
}

/** Sélectionne les satellites suivis, en complétant avec les TLE embarqués si absents. */
export function pickTracked(set: TleSet, noradIds: readonly number[] = DEFAULT_TRACKED_NORAD_IDS): TleRecord[] {
  return noradIds
    .map((id) => set.records.find((r) => r.noradId === id) ?? BUNDLED_TLES.find((r) => r.noradId === id))
    .filter((r): r is TleRecord => r !== undefined)
}
