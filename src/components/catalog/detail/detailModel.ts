/**
 * Modèle de la fiche détaillée : résolution d'une clé de verrouillage en cible
 * (ciel profond, étoile, astre du système solaire), en-tête, caractéristiques
 * et cible du simulateur de champ.
 */
import { BRIGHT_STARS, CONSTELLATION_FIGURES } from '../../../data'
import { findDeepSkyEntry } from '../../../services/catalog/entries'
import { getBodyEphemeris, getBodyEquatorJ2000 } from '../../../services/astroEngine'
import type { BodyEphemeris, ObserverLocation, SkyTarget, SolarSystemBodyId } from '../../../types/astro'
import type { BrightStar } from '../../../types/catalog'
import type { DeepSkyEntry } from '../../../types/encyclopedia'
import { fmtMag, fmtNumber } from '../../ui/format'
import type { FovTarget } from '../fov/FovSimulator'
import type { PhysicalFact } from './PhysicalCard'
import { SOLAR_SYSTEM_KEYS } from '../catalogItems'

export type DetailTarget =
  | { readonly kind: 'dso'; readonly key: string; readonly entry: DeepSkyEntry }
  | { readonly kind: 'star'; readonly key: string; readonly star: BrightStar }
  | { readonly kind: 'body'; readonly key: string; readonly id: SolarSystemBodyId }

export function resolveDetailTarget(key: string): DetailTarget | null {
  if ((SOLAR_SYSTEM_KEYS as readonly string[]).includes(key)) return { kind: 'body', key, id: key as SolarSystemBodyId }
  if (key.startsWith('HIP')) {
    const star = BRIGHT_STARS.find((s) => `HIP${s.hip}` === key)
    return star ? { kind: 'star', key, star } : null
  }
  const entry = findDeepSkyEntry(key)
  return entry ? { kind: 'dso', key, entry } : null
}

const conFr = (abbr: string) => CONSTELLATION_FIGURES.find((c) => c.id === abbr)?.nameFr ?? abbr

export interface DetailHeader {
  readonly code: string
  readonly title: string
  readonly subtitle: string
  readonly raDeg: number
  readonly decDeg: number
  /** Coordonnées de la date (astres mobiles) ou J2000 (objets fixes). */
  readonly ofDate: boolean
}

export function detailSkyTarget(t: DetailTarget): SkyTarget {
  if (t.kind === 'body') return { kind: 'body', id: t.id }
  const { raDeg, decDeg } = t.kind === 'dso' ? t.entry.object : t.star
  return { kind: 'fixed', raDeg, decDeg, label: t.key }
}

export function detailHeader(t: DetailTarget, eph: BodyEphemeris | null): DetailHeader {
  if (t.kind === 'dso') {
    const e = t.entry
    const alias = e.aliases.length ? ` · ${e.aliases.join(' · ')}` : ''
    return { code: e.code, title: e.object.name ?? e.code, subtitle: `${e.typeLabel} · ${e.constellationFr}${alias}`, raDeg: e.object.raDeg, decDeg: e.object.decDeg, ofDate: false }
  }
  if (t.kind === 'star') {
    const s = t.star
    return { code: s.designation, title: s.name ?? s.designation, subtitle: `Étoile · ${conFr(s.constellation)} · HIP ${s.hip}`, raDeg: s.raDeg, decDeg: s.decDeg, ofDate: false }
  }
  const e = eph!
  return {
    code: e.nameFr, title: e.nameFr,
    subtitle: `${t.id === 'Moon' ? 'Satellite naturel' : t.id === 'Sun' ? 'Étoile' : 'Planète'} · ${conFr(e.constellation)}`,
    raDeg: e.raHours * 15, decDeg: e.decDeg, ofDate: true,
  }
}

export function bodyEphemeris(t: DetailTarget, date: Date, loc: ObserverLocation): BodyEphemeris | null {
  return t.kind === 'body' ? getBodyEphemeris(t.id, date, loc) : null
}

const arcmin = (v: number | null) => (v === null ? '—' : fmtNumber(v, v < 10 ? 1 : 0))

export function physicalFacts(t: DetailTarget, eph: BodyEphemeris | null): { facts: PhysicalFact[]; note?: string } {
  if (t.kind === 'dso') {
    const e = t.entry
    const o = e.object
    const sb = e.surfaceBrightness
    return {
      facts: [
        { label: 'Magnitude V', value: fmtMag(o.mag) },
        { label: 'Brillance surf.', value: sb === null ? '—' : fmtNumber(sb, 1), unit: sb === null ? undefined : 'mag/″²' },
        { label: 'Dimensions', value: `${arcmin(o.sizeMajorArcmin)} × ${arcmin(o.sizeMinorArcmin)}`, unit: '′' },
        { label: 'Angle de position', value: e.positionAngleDeg === null ? '—' : `${fmtNumber(e.positionAngleDeg, 0)}°` },
      ],
      note:
        e.surfaceBrightnessOrigin === 'measured' ? 'Brillance de surface mesurée (OpenNGC) ; dimensions du catalogue en minutes d’arc.'
        : e.surfaceBrightnessOrigin === 'computed' ? 'Brillance de surface moyenne calculée depuis la magnitude et les dimensions (ellipse).'
        : undefined,
    }
  }
  if (t.kind === 'star') {
    const s = t.star
    return {
      facts: [
        { label: 'Magnitude V', value: fmtMag(s.mag) },
        { label: 'Indice B−V', value: s.bv === null ? '—' : fmtNumber(s.bv, 2) },
      ],
      note: 'Étoile ponctuelle : diamètre apparent inférieur à 0,05″.',
    }
  }
  const e = eph!
  return {
    facts: [
      { label: 'Magnitude', value: fmtMag(e.magnitude) },
      { label: 'Diamètre', value: e.angularDiameterArcsec >= 120 ? fmtNumber(e.angularDiameterArcsec / 60, 1) : fmtNumber(e.angularDiameterArcsec, 1), unit: e.angularDiameterArcsec >= 120 ? '′' : '″' },
      { label: 'Éclairement', value: `${fmtNumber(e.illuminatedFraction * 100, 0)}`, unit: '%' },
      { label: 'Distance', value: e.distanceAu < 0.01 ? fmtNumber(e.distanceAu * 149_597_870.7, 0) : fmtNumber(e.distanceAu, 3), unit: e.distanceAu < 0.01 ? 'km' : 'ua' },
    ],
  }
}

/** Cible du simulateur de champ et de la comparaison lunaire. */
export function fovTarget(t: DetailTarget, header: DetailHeader, eph: BodyEphemeris | null, date: Date, loc: ObserverLocation): FovTarget {
  if (t.kind === 'dso') {
    const o = t.entry.object
    const major = o.sizeMajorArcmin
    const minor = o.sizeMinorArcmin ?? major
    return {
      code: header.code, raDeg: o.raDeg, decDeg: o.decDeg, excludeId: o.id, majorArcmin: major,
      main: major === null
        ? { kind: 'star' }
        : { kind: 'dso', spec: { type: o.type, seed: o.id, outline: true }, majorArcmin: major, minorArcmin: minor ?? major, paDeg: t.entry.positionAngleDeg ?? 90 },
    }
  }
  if (t.kind === 'star') return { code: header.code, raDeg: header.raDeg, decDeg: header.decDeg, excludeId: null, majorArcmin: null, main: { kind: 'star' } }
  // Astre mobile : coordonnées J2000 pour rester dans le repère des voisins de catalogue.
  const { raDeg, decDeg } = getBodyEquatorJ2000(t.id, date, loc)
  const d = eph!.angularDiameterArcsec / 60
  return { code: header.code, raDeg, decDeg, excludeId: null, majorArcmin: d, main: { kind: 'disk', diameterArcmin: d } }
}
