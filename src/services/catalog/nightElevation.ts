/**
 * Profil d'élévation d'une cible sur la nuit d'observation : courbe fine,
 * relevés heure par heure, zones crépusculaires, culmination affinée à la
 * minute et lever / passage au méridien / coucher (astronomy-engine).
 */
import type { ObserverLocation, RiseTransitSet, SkyTarget } from '../../types/astro'
import type { Culmination, HourlyAltitude, NightElevationProfile } from '../../types/encyclopedia'
import type { NightTimeline, TwilightSegment } from '../../types/tonight'
import { fixedRiseTransitSet } from '../astro/fixedObject'
import { getNightTimeline } from '../astro/nightTimeline'
import { getRiseTransitSet } from '../astro/riseSet'
import { getAltitudeCurve, targetHorizontal } from '../astro/skyProjector'
import { OBSERVABLE_MIN_ALT_DEG } from './filters'

const MIN = 60_000
const HOUR = 3_600_000
/** Pas de la courbe fine, en minutes. */
export const ELEVATION_STEP_MIN = 10

/** Fenêtre affichée : 1 h avant la première transition crépusculaire → 1 h après la dernière. */
export function elevationWindow(tl: NightTimeline): { start: Date; end: Date } {
  if (tl.transitions.length === 0) return { start: tl.start, end: tl.end }
  const first = tl.transitions[0].time.getTime() - HOUR
  const last = tl.transitions[tl.transitions.length - 1].time.getTime() + HOUR
  return { start: new Date(Math.max(tl.start.getTime(), first)), end: new Date(Math.min(tl.end.getTime(), last)) }
}

const isDark = (segments: readonly TwilightSegment[], t: number) =>
  segments.some((s) => s.phase === 'night' && t >= s.start.getTime() && t < s.end.getTime())

/** Heures rondes locales (fuseau de l'appareil) comprises dans [start, end]. */
export function roundHours(start: Date, end: Date): Date[] {
  const first = new Date(start.getTime())
  first.setMinutes(0, 0, 0)
  if (first.getTime() < start.getTime()) first.setTime(first.getTime() + HOUR)
  const out: Date[] = []
  for (let t = first.getTime(); t <= end.getTime(); t += HOUR) out.push(new Date(t))
  return out
}

/** Affine un maximum de hauteur à la minute autour de `aroundMs` (±`spanMin`), borné à la fenêtre. */
function refineMaximum(target: SkyTarget, aroundMs: number, spanMin: number, start: number, end: number, loc: ObserverLocation) {
  let bestT = aroundMs
  let bestAlt = targetHorizontal(target, new Date(aroundMs), loc).altitudeDeg
  for (let t = Math.max(start, aroundMs - spanMin * MIN); t <= Math.min(end, aroundMs + spanMin * MIN); t += MIN) {
    const alt = targetHorizontal(target, new Date(t), loc).altitudeDeg
    if (alt > bestAlt) {
      bestAlt = alt
      bestT = t
    }
  }
  return { time: new Date(bestT), altitudeDeg: bestAlt }
}

export function targetRiseTransitSet(target: SkyTarget, start: Date, loc: ObserverLocation): RiseTransitSet {
  return target.kind === 'body'
    ? getRiseTransitSet(target.id, start, loc)
    : fixedRiseTransitSet(target.raDeg, target.decDeg, start, loc)
}

/**
 * Profil complet pour la nuit d'observation contenant `date`.
 * @param timeline frise de la nuit déjà calculée (évite de la recalculer par cible).
 */
export function getNightElevationProfile(
  target: SkyTarget,
  date: Date,
  loc: ObserverLocation,
  timeline: NightTimeline = getNightTimeline(date, loc),
): NightElevationProfile {
  const { start, end } = elevationWindow(timeline)
  const t0 = start.getTime()
  const t1 = end.getTime()
  const samples = getAltitudeCurve(target, start, t1 - t0, ELEVATION_STEP_MIN * MIN, loc)
  const segments = timeline.segments

  const hourly: HourlyAltitude[] = roundHours(start, end).map((time) => {
    const hor = targetHorizontal(target, time, loc)
    return { time, altitudeDeg: hor.altitudeDeg, azimuthDeg: hor.azimuthDeg, dark: isDark(segments, time.getTime()) }
  })

  const top = samples.reduce((a, b) => (b.altitudeDeg > a.altitudeDeg ? b : a), samples[0])
  const refined = refineMaximum(target, top.time.getTime(), ELEVATION_STEP_MIN, t0, t1, loc)
  const culmination: Culmination = { ...refined, duringDarkness: isDark(segments, refined.time.getTime()) }

  let observableDarkMinutes = 0
  for (const s of samples) {
    if (s.altitudeDeg > OBSERVABLE_MIN_ALT_DEG && isDark(segments, s.time.getTime())) observableDarkMinutes += ELEVATION_STEP_MIN
  }

  return {
    start,
    end,
    samples,
    hourly,
    segments,
    culmination,
    riseTransitSet: targetRiseTransitSet(target, timeline.start, loc),
    observableDarkMinutes,
  }
}
