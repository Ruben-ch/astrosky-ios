/**
 * Échantillonnage partagé du classement des cibles : instants de la fenêtre,
 * hauteur de la Lune à chaque instant et séparation angulaire à la Lune.
 */
import { AngleBetween, Body, Equator, Spherical, VectorFromSphere } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import { getBodyHorizontal, toObserver } from '../astro/bodies'

export interface WindowSamples {
  readonly times: readonly Date[]
  readonly stepMinutes: number
  /** Hauteur de la Lune à chaque instant de `times`, en degrés. */
  readonly moonAltitudeDeg: readonly number[]
}

export function sampleWindow(start: Date, end: Date, stepMinutes: number, loc: ObserverLocation): WindowSamples {
  const times: Date[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += stepMinutes * 60_000) times.push(new Date(t))
  return { times, stepMinutes, moonAltitudeDeg: times.map((t) => getBodyHorizontal('Moon', t, loc).altitudeDeg) }
}

export interface AltitudeStats {
  readonly maxAltitudeDeg: number
  readonly bestIndex: number
  readonly minutesAbove30Deg: number
}

/** Hauteur maximale, indice du meilleur instant et durée au-dessus de 30°. */
export function altitudeStats(altitudesDeg: readonly number[], stepMinutes: number): AltitudeStats {
  let max = -90
  let bestIndex = 0
  let above = 0
  altitudesDeg.forEach((a, i) => {
    if (a > max) {
      max = a
      bestIndex = i
    }
    if (a >= 30) above += stepMinutes
  })
  return { maxAltitudeDeg: max, bestIndex, minutesAbove30Deg: above }
}

/**
 * Fabrique un calculateur de séparation à la Lune (degrés) pour des
 * coordonnées J2000, figé à l'instant `date` (position topocentrique de la Lune).
 */
export function createMoonSeparation(date: Date, loc: ObserverLocation): (raDeg: number, decDeg: number) => number {
  const moon = Equator(Body.Moon, date, toObserver(loc), false, true)
  const moonVec = VectorFromSphere(new Spherical(moon.dec, moon.ra * 15, 1), date)
  return (raDeg, decDeg) => AngleBetween(moonVec, VectorFromSphere(new Spherical(decDeg, raDeg, 1), date))
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Note de hauteur 0–1 : culmination (sinus) et durée confortable au-dessus de 30°. */
export function altitudeScore(maxAltitudeDeg: number, minutesAbove30Deg: number): number {
  const culmination = Math.sin((clamp01(maxAltitudeDeg / 90) * Math.PI) / 2)
  return 0.6 * culmination + 0.4 * clamp01(minutesAbove30Deg / 240)
}
