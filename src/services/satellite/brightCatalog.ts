/**
 * Catalogue des satellites brillants : magnitudes standard embarquées,
 * noms courts et sélection des candidats aux passages visibles.
 */
import { BRIGHT_SATELLITE_MAGNITUDES } from '../../data/brightSatellites.generated'
import type { OrbitalCandidate } from '../../types/orbital'
import type { TleRecord, TleSet } from '../../types/services'

export const ISS_NORAD = 25544
export const TIANGONG_NORAD = 48274
export const HUBBLE_NORAD = 20580

/** Satellites toujours suivis : un passage visible est retenu quelle que soit sa magnitude. */
export const ALWAYS_INCLUDED: readonly number[] = [ISS_NORAD, TIANGONG_NORAD]

/** Magnitude limite d'un passage (satellite non suivi) : plus brillant que 2,5. */
export const PASS_MAGNITUDE_LIMIT = 2.5

/** Orbite basse (révolutions / jour) : seuls ces satellites défilent assez vite et près pour un passage. */
const LEO_MIN_REV_PER_DAY = 11

const SHORT_NAMES: Readonly<Record<number, string>> = { [ISS_NORAD]: 'ISS', [TIANGONG_NORAD]: 'Tiangong', [HUBBLE_NORAD]: 'Hubble' }

/** Magnitude standard connue (1000 km, 50 % éclairé), `null` sinon. */
export function standardMagnitude(noradId: number): number | null {
  return BRIGHT_SATELLITE_MAGNITUDES[noradId]?.stdMag ?? null
}

/** Nom d'affichage : nom court consacré, sinon nom TLE en casse de titre (« SL-16 R/B »). */
export function satelliteDisplayName(record: Pick<TleRecord, 'noradId' | 'name'>): string {
  return SHORT_NAMES[record.noradId] ?? record.name.replace(/\s+/g, ' ').trim()
}

/** Révolutions par jour lues dans la ligne 2 (colonnes 53–63). */
export function meanMotionRevPerDay(record: TleRecord): number {
  return Number(record.line2.slice(52, 63))
}

/**
 * Candidats aux passages visibles : satellites suivis (ISS, Tiangong) et
 * satellites en orbite basse de magnitude standard connue, du plus brillant au plus faible.
 */
export function selectCandidates(set: Pick<TleSet, 'records'>, always: readonly number[] = ALWAYS_INCLUDED): OrbitalCandidate[] {
  const seen = new Set<number>()
  const out: OrbitalCandidate[] = []
  for (const record of set.records) {
    if (seen.has(record.noradId)) continue
    const stdMag = standardMagnitude(record.noradId)
    const tracked = always.includes(record.noradId)
    if (!tracked && (stdMag === null || meanMotionRevPerDay(record) < LEO_MIN_REV_PER_DAY)) continue
    seen.add(record.noradId)
    out.push({ record, stdMag })
  }
  return out.sort((a, b) => Number(always.includes(b.record.noradId)) - Number(always.includes(a.record.noradId)) || (a.stdMag ?? 9) - (b.stdMag ?? 9))
}
