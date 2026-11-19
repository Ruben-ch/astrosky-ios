/**
 * Échantillonnage d'un passage : position topocentrique (SGP4), ombre de la
 * Terre (shadowFraction), magnitude estimée et visibilité, puis évènements
 * affinés à la seconde (entrée / sortie de l'ombre, culmination).
 */
import { degreesToRadians, ecfToLookAngles, eciToEcf, gstime, jday, propagate, radiansToDegrees, shadowFraction, sunPos } from 'satellite.js'
import type { ObserverLocation } from '../../types/astro'
import type { PassEvent, PassTrackPoint } from '../../types/orbital'
import type { TleRecord } from '../../types/services'
import { getSunGeometricAltitudeDeg } from '../astro/bodies'
import { getSatrec } from '../satelliteTracker'
import { observerEci, phaseAngleDeg, satelliteMagnitude } from './magnitude'
import { isTleValidAt } from './tle'

/** Fraction d'ombre au-delà de laquelle le satellite est considéré éteint. */
export const SHADOW_THRESHOLD = 0.5
/** Hauteur maximale du Soleil pour qu'un satellite éclairé soit visible (fin du crépuscule civil). */
export const SUN_MAX_ALT_DEG = -6
/** Pas de la trajectoire échantillonnée, en millisecondes. */
export const TRACK_STEP_MS = 10_000

export interface SampleOptions {
  readonly stdMag: number | null
  /** Calcule la hauteur du Soleil (visibilité) : coûteux, inutile pendant le balayage grossier. */
  readonly withSun?: boolean
}

/**
 * Échantillonneur figé sur un satellite et un observateur. Hors de la fenêtre
 * de validité TLE (±30 j) ou orbite décrue : hauteur −90 et échantillon `null`.
 */
export function createSampler(record: TleRecord, loc: ObserverLocation) {
  const satrec = getSatrec(record)
  const geo = { latitude: degreesToRadians(loc.latitudeDeg), longitude: degreesToRadians(loc.longitudeDeg), height: loc.elevationM / 1000 }

  /** Hauteur seule (balayage rapide), −90 si propagation impossible. */
  const elevation = (t: number): number => {
    const date = new Date(t)
    if (!isTleValidAt(record, date)) return -90
    const pv = propagate(satrec, date)
    if (!pv) return -90
    return radiansToDegrees(ecfToLookAngles(geo, eciToEcf(pv.position, gstime(date))).elevation)
  }

  const sample = (t: number, opts: SampleOptions): PassTrackPoint | null => {
    const date = new Date(t)
    if (!isTleValidAt(record, date)) return null
    const pv = propagate(satrec, date)
    if (!pv) return null
    const look = ecfToLookAngles(geo, eciToEcf(pv.position, gstime(date)))
    const sun = sunPos(jday(date)).rsun
    const shadow = shadowFraction(sun, pv.position)
    const sunlit = shadow < SHADOW_THRESHOLD
    const elevationDeg = radiansToDegrees(look.elevation)
    const magnitude =
      sunlit && opts.stdMag !== null
        ? satelliteMagnitude(opts.stdMag, look.rangeSat, phaseAngleDeg(pv.position, sun, observerEci(geo.latitude, geo.longitude, geo.height, date)), shadow)
        : null
    const dark = opts.withSun ? getSunGeometricAltitudeDeg(date, loc) < SUN_MAX_ALT_DEG : false
    return {
      time: date,
      azimuthDeg: (radiansToDegrees(look.azimuth) + 360) % 360,
      elevationDeg,
      rangeKm: look.rangeSat,
      shadowFraction: shadow,
      sunlit,
      magnitude,
      visible: sunlit && elevationDeg > 0 && dark,
    }
  }

  return { elevation, sample }
}

export type Sampler = ReturnType<typeof createSampler>

/** Bissection à 1 s près de l'instant où `predicate` change de valeur entre tA et tB. */
export function bisect(predicate: (t: number) => boolean, tA: number, tB: number): number {
  const a = predicate(tA)
  let [lo, hi] = [tA, tB]
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2
    if (predicate(mid) === a) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Recherche ternaire du maximum d'une fonction unimodale sur [tA, tB], à 1 s près. */
export function ternaryMax(f: (t: number) => number, tA: number, tB: number): number {
  let [lo, hi] = [tA, tB]
  while (hi - lo > 1000) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (f(m1) < f(m2)) lo = m1
    else hi = m2
  }
  return (lo + hi) / 2
}

export const toEvent = (p: PassTrackPoint): PassEvent => ({ time: p.time, azimuthDeg: p.azimuthDeg, elevationDeg: p.elevationDeg, magnitude: p.magnitude })

/** Trajectoire complète du lever au coucher (pas fixe, coucher inclus). */
export function sampleTrack(sampler: Sampler, riseMs: number, setMs: number, stdMag: number | null): PassTrackPoint[] {
  const out: PassTrackPoint[] = []
  for (let t = riseMs; t < setMs; t += TRACK_STEP_MS) {
    const p = sampler.sample(t, { stdMag, withSun: true })
    if (p) out.push(p)
  }
  const last = sampler.sample(setMs, { stdMag, withSun: true })
  if (last) out.push(last)
  return out
}

/** Entrée et sortie de l'ombre de la Terre pendant la trajectoire, affinées à la seconde. */
export function shadowTransitions(sampler: Sampler, track: readonly PassTrackPoint[], stdMag: number | null): { entry: PassEvent | null; exit: PassEvent | null } {
  let entry: PassEvent | null = null
  let exit: PassEvent | null = null
  const lit = (t: number) => (sampler.sample(t, { stdMag })?.shadowFraction ?? 1) < SHADOW_THRESHOLD
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]
    const b = track[i]
    if (a.sunlit === b.sunlit) continue
    const t = bisect(lit, a.time.getTime(), b.time.getTime())
    const p = sampler.sample(t, { stdMag, withSun: true })
    if (!p) continue
    const ev = toEvent({ ...p, magnitude: a.sunlit ? a.magnitude : b.magnitude })
    if (a.sunlit && !entry) entry = ev
    else if (!a.sunlit && !exit) exit = ev
  }
  return { entry, exit }
}
