/**
 * Lever, culmination et coucher d'un objet fixe (étoile, ciel profond) via les
 * étoiles définies par l'utilisateur d'astronomy-engine (`DefineStar`, `Star1`).
 * Les appels sont synchrones et réutilisent `Star1` : sans effet de bord durable.
 */
import { Body, DefineStar, SearchHourAngle, SearchRiseSet } from 'astronomy-engine'
import type { ObserverLocation, RiseTransitSet } from '../../types/astro'
import { createSkyProjector } from './skyProjector'
import { toObserver } from './bodies'

const MS_PER_DAY = 86_400_000
/** Distance conventionnelle (années-lumière) : la parallaxe d'objets lointains est nulle. */
const FAR_LIGHT_YEARS = 1000

/** Lever / culmination / coucher sur les 24 h suivant `start` pour des coordonnées J2000. */
export function fixedRiseTransitSet(raDeg: number, decDeg: number, start: Date, loc: ObserverLocation): RiseTransitSet {
  DefineStar(Body.Star1, (((raDeg % 360) + 360) % 360) / 15, decDeg, FAR_LIGHT_YEARS)
  const observer = toObserver(loc)
  const rise = SearchRiseSet(Body.Star1, observer, +1, start, 1)
  const set = SearchRiseSet(Body.Star1, observer, -1, start, 1)
  const transit = SearchHourAngle(Body.Star1, observer, 0, start, +1)
  const inWindow = transit.time.date.getTime() - start.getTime() <= MS_PER_DAY
  let alwaysUp = false
  let alwaysDown = false
  if (!rise && !set) {
    alwaysUp = createSkyProjector(start, loc)(raDeg, decDeg).altitudeDeg > 0
    alwaysDown = !alwaysUp
  }
  return {
    rise: rise?.date ?? null,
    set: set?.date ?? null,
    transit: inWindow ? transit.time.date : null,
    transitAltitudeDeg: inWindow ? transit.hor.altitude : null,
    alwaysUp,
    alwaysDown,
  }
}
