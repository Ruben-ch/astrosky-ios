/** Segments du Catalogue et lignes des étoiles brillantes / du système solaire. */
import { BRIGHT_STARS, CONSTELLATION_FIGURES, DEEP_SKY_CATALOG } from '../../data'
import { PLANETS, getBodyEphemeris } from '../../services/astroEngine'
import { normalizeText } from '../../services/catalog/search'
import { starColor } from '../../theme/starColor'
import type { RenderPalette, ThemeName } from '../../theme/palette'
import type { ObserverLocation, SolarSystemBodyId } from '../../types/astro'

export type CatalogSegment = 'deep-sky' | 'stars' | 'planets'

export const SOLAR_SYSTEM_KEYS: readonly SolarSystemBodyId[] = ['Moon', ...PLANETS]

export const CATALOG_SEGMENTS: readonly { id: CatalogSegment; label: string; count: number }[] = [
  { id: 'deep-sky', label: 'Ciel profond', count: DEEP_SKY_CATALOG.length },
  { id: 'stars', label: 'Étoiles', count: BRIGHT_STARS.length },
  { id: 'planets', label: 'Système solaire', count: SOLAR_SYSTEM_KEYS.length },
]

export interface CatalogItem {
  readonly key: string
  readonly code: string
  readonly name: string
  readonly subtitle: string
  readonly raDeg: number
  readonly decDeg: number
  readonly mag: number | null
  readonly swatch: string
  /** Astre mobile du système solaire (coordonnées recalculées à chaque instant). */
  readonly bodyId?: SolarSystemBodyId
  readonly searchText: string
}

/** Segment contenant la clé `key`, ou `null` si inconnue. */
export function segmentForKey(key: string): CatalogSegment | null {
  if ((SOLAR_SYSTEM_KEYS as readonly string[]).includes(key)) return 'planets'
  if (key.startsWith('HIP')) return BRIGHT_STARS.some((s) => `HIP${s.hip}` === key) ? 'stars' : null
  return DEEP_SKY_CATALOG.some((d) => d.id === key) ? 'deep-sky' : null
}

const conFr = new Map(CONSTELLATION_FIGURES.map((c) => [c.id, c.nameFr]))

/** Étoiles brillantes (indépendantes du temps), pastille colorée selon B−V. */
export function starItems(theme: ThemeName): CatalogItem[] {
  return BRIGHT_STARS.map((s) => {
    const con = conFr.get(s.constellation) ?? s.constellation
    return {
      key: `HIP${s.hip}`, code: s.designation, name: s.name ?? s.designation,
      subtitle: `${s.designation} · ${con} · B−V ${s.bv?.toFixed(2) ?? '—'}`,
      raDeg: s.raDeg, decDeg: s.decDeg, mag: s.mag, swatch: starColor(s.bv, theme),
      searchText: normalizeText(`${s.name ?? ''} ${s.designation} ${s.constellation} ${con} HIP ${s.hip}`),
    }
  })
}

/** Lune et planètes à l'instant `date` (coordonnées apparentes de la date). */
export function solarSystemItems(date: Date, loc: ObserverLocation, p: RenderPalette): CatalogItem[] {
  return SOLAR_SYSTEM_KEYS.map((id) => {
    const e = getBodyEphemeris(id, date, loc)
    const con = conFr.get(e.constellation) ?? e.constellation
    return {
      key: id, code: e.nameFr, name: e.nameFr,
      subtitle: `${id === 'Moon' ? 'Satellite naturel' : 'Planète'} · ${con} · ${Math.round(e.illuminatedFraction * 100)} % éclairé`,
      raDeg: e.raHours * 15, decDeg: e.decDeg, mag: e.magnitude, swatch: p.bodies[id], bodyId: id,
      searchText: normalizeText(`${e.nameFr} ${id} ${con}`),
    }
  })
}
