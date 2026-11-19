/**
 * Classement dynamique des meilleures cibles de la nuit pour un instrument :
 * ciel profond (Messier + NGC/IC), planètes et Lune.
 * Positions : astronomy-engine (projecteur J2000→horizontal, Equator, Illumination).
 * Note = hauteur × détectabilité (magnitude, brillance de surface) × adéquation
 * au champ × gêne lunaire pondérée par la sensibilité du type d'objet.
 */
import { Body, Illumination } from 'astronomy-engine'
import { DEEP_SKY_CATALOG, DEEP_SKY_TYPE_LABEL_FR } from '../../data'
import type { ObserverLocation } from '../../types/astro'
import type { DeepSkyObject, DeepSkyType } from '../../types/catalog'
import type { InstrumentId, RankedTarget, TargetTag } from '../../types/tonight'
import { estimateLimitingMagnitude } from '../astro/meteors'
import { getDarkWindow, getTwilightTimes } from '../astro/riseSet'
import { createSkyProjector } from '../astro/skyProjector'
import { EXTENDED_OFFSET, INSTRUMENTS, effectiveSurfaceLimit, stellarLimitingMagnitude, surfaceBrightness } from './instruments'
import { rankSolarSystem } from './solarSystemTargets'
import { altitudeScore, altitudeStats, clamp01, createMoonSeparation, sampleWindow } from './sampling'

/** Hauteur minimale de culmination pour proposer un objet du ciel profond. */
export const MIN_DSO_ALTITUDE_DEG = 15

/** Sensibilité au fond de ciel lunaire (1 = objets diffus, 0,3 = amas stellaires). */
const MOON_SENSITIVITY: Readonly<Record<DeepSkyType, number>> = {
  galaxy: 1, 'emission-nebula': 1, 'reflection-nebula': 1, 'dark-nebula': 1, 'supernova-remnant': 1,
  'cluster-nebula': 0.8, 'planetary-nebula': 0.6, 'globular-cluster': 0.6,
  'open-cluster': 0.3, 'star-cloud': 0.4, 'double-star': 0.1, asterism: 0.2,
}

/** Intérêt visuel du type d'objet (les étoiles doubles et astérismes sont des curiosités). */
const TYPE_INTEREST: Partial<Record<DeepSkyType, number>> = { 'double-star': 0.5, asterism: 0.6, 'dark-nebula': 0.7 }

/** Plage de magnitudes (sous la limite) sur laquelle l'éclat d'un objet est valorisé. */
const MAG_SPAN = 6


export interface RankOptions {
  readonly instrument: InstrumentId
  readonly limit?: number
  readonly stepMinutes?: number
  readonly catalog?: readonly DeepSkyObject[]
}

function dsoCode(o: DeepSkyObject): string {
  return o.messier !== null ? `M${o.messier}` : (o.ngc ?? o.id)
}

/** Classe les cibles de la nuit d'observation contenant `date`, meilleure en tête. */
export function rankTargets(date: Date, loc: ObserverLocation, options: RankOptions): RankedTarget[] {
  const profile = INSTRUMENTS[options.instrument]
  const stepMinutes = options.stepMinutes ?? 15
  const win = getDarkWindow(date, loc)
  const samples = sampleWindow(win.start, win.end, stepMinutes, loc)
  const mid = new Date((win.start.getTime() + win.end.getTime()) / 2)
  const moonIllum = Illumination(Body.Moon, mid).phase_fraction
  const separation = createMoonSeparation(mid, loc)
  const projectors = samples.times.map((t) => createSkyProjector(t, loc))

  const out: RankedTarget[] = []
  for (const o of options.catalog ?? DEEP_SKY_CATALOG) {
    if (o.mag === null) continue
    const stats = altitudeStats(projectors.map((p) => p(o.raDeg, o.decDeg).altitudeDeg), stepMinutes)
    if (stats.maxAltitudeDeg < MIN_DSO_ALTITUDE_DEG) continue
    const moonAltAtBest = samples.moonAltitudeDeg[stats.bestIndex]
    const nelm = estimateLimitingMagnitude(moonIllum, moonAltAtBest)
    const magLimit = stellarLimitingMagnitude(profile, nelm) - EXTENDED_OFFSET[profile.id]
    if (o.mag > magLimit) continue
    const sb = surfaceBrightness(o.mag, o.sizeMajorArcmin, o.sizeMinorArcmin)
    const sbLimit = effectiveSurfaceLimit(profile, nelm)
    if (sb !== null && sb > sbLimit + 0.5) continue

    const magScore = clamp01((magLimit - o.mag) / MAG_SPAN)
    const sbScore = sb === null ? 1 : clamp01((sbLimit + 0.5 - sb) / 2.5)
    const sizeArcmin = o.sizeMajorArcmin ?? 0
    const tooLarge = sizeArcmin > profile.fieldDeg * 60
    const tooSmall = profile.id !== 'telescope' && sizeArcmin > 0 && sizeArcmin < (profile.id === 'naked-eye' ? 20 : 3)
    const sizeFit = tooLarge ? 0.6 : tooSmall ? 0.65 : 1
    const sepDeg = separation(o.raDeg, o.decDeg)
    const moonUp = moonAltAtBest > 0 ? 1 : 0
    const moonFactor = moonIllum * moonUp * (1 - clamp01(sepDeg / 100))
    const moonPenalty = 1 - 0.7 * moonFactor * MOON_SENSITIVITY[o.type]
    const score = 100 * altitudeScore(stats.maxAltitudeDeg, stats.minutesAbove30Deg) ** 0.8 * (0.35 + 0.65 * magScore) * (0.3 + 0.7 * sbScore) * sizeFit * moonPenalty * (TYPE_INTEREST[o.type] ?? 1)

    const tags: TargetTag[] = []
    if (stats.maxAltitudeDeg >= 60) tags.push('high')
    if (stats.minutesAbove30Deg >= 240) tags.push('long-window')
    if (magLimit - o.mag >= 3) tags.push('bright')
    if (sizeArcmin >= (profile.fieldDeg * 60) / 2) tags.push('large')
    if (moonIllum >= 0.3 && moonUp) tags.push(...(sepDeg >= 60 ? (['moon-far'] as const) : sepDeg < 25 ? (['moon-near'] as const) : []))

    const code = dsoCode(o)
    out.push({
      key: o.id, kind: 'deep-sky', code, name: o.name ?? code, typeLabel: DEEP_SKY_TYPE_LABEL_FR[o.type],
      deepSkyType: o.type, bodyId: null, constellation: o.constellation, magnitude: o.mag,
      score: Math.round(score), maxAltitudeDeg: stats.maxAltitudeDeg, bestTime: samples.times[stats.bestIndex],
      minutesAbove30Deg: stats.minutesAbove30Deg, moonSeparationDeg: sepDeg, tags,
    })
  }

  const tw = getTwilightTimes(date, loc)
  const planetStart = tw.civilDusk ?? tw.sunset ?? win.start
  const planetEnd = tw.civilDawn ?? tw.sunrise ?? win.end
  const planetWin = planetEnd > planetStart ? { start: planetStart, end: planetEnd } : win
  out.push(...rankSolarSystem(loc, profile, planetWin, win, stepMinutes, moonIllum, separation))

  return out
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || (a.magnitude ?? 99) - (b.magnitude ?? 99))
    .slice(0, options.limit ?? 15)
}
