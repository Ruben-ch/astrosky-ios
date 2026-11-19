/**
 * Lever / passage au méridien / coucher et crépuscules.
 * La « nuit d'observation » est délimitée par deux midis solaires vrais locaux
 * (SearchHourAngle du Soleil), donc indépendante du fuseau horaire de l'appareil.
 */
import { Body, SearchAltitude, SearchHourAngle, SearchRiseSet } from 'astronomy-engine'
import type { ObserverLocation, RiseTransitSet, SolarSystemBodyId, TwilightTimes } from '../../types/astro'
import { getBodyHorizontal, getSunGeometricAltitudeDeg, toEngineBody, toObserver } from './bodies'

const MS_PER_DAY = 86_400_000

/** Hauteurs du centre du Soleil définissant les crépuscules, en degrés. */
export const TWILIGHT_ALTITUDE_DEG = { civil: -6, nautical: -12, astronomical: -18 } as const

/** Midi solaire vrai local précédant (ou égal à) `date` : début de la nuit d'observation. */
export function observingNightStart(date: Date, loc: ObserverLocation): Date {
  return SearchHourAngle(Body.Sun, toObserver(loc), 0, date, -1).time.date
}

/**
 * Prochains lever, culmination et coucher sur 24 h à partir de `start`.
 * Pour le Soleil et la Lune, le lever/coucher se rapporte au bord supérieur.
 */
export function getRiseTransitSet(id: SolarSystemBodyId, start: Date, loc: ObserverLocation): RiseTransitSet {
  const body = toEngineBody(id)
  const observer = toObserver(loc)
  const rise = SearchRiseSet(body, observer, +1, start, 1)
  const set = SearchRiseSet(body, observer, -1, start, 1)
  const transit = SearchHourAngle(body, observer, 0, start, +1)
  const transitInWindow = transit.time.date.getTime() - start.getTime() <= MS_PER_DAY
  let alwaysUp = false
  let alwaysDown = false
  if (!rise && !set) {
    const altNow = getBodyHorizontal(id, start, loc).altitudeDeg
    alwaysUp = altNow > 0
    alwaysDown = !alwaysUp
  }
  return {
    rise: rise?.date ?? null,
    set: set?.date ?? null,
    transit: transitInWindow ? transit.time.date : null,
    transitAltitudeDeg: transitInWindow ? transit.hor.altitude : null,
    alwaysUp,
    alwaysDown,
  }
}

function sunCrossing(direction: 1 | -1, start: Date, loc: ObserverLocation, altitudeDeg: number): Date | null {
  return SearchAltitude(Body.Sun, toObserver(loc), direction, start, 1, altitudeDeg)?.date ?? null
}

/**
 * Coucher, crépuscules du soir, aubes du matin et lever du Soleil pour la nuit
 * d'observation contenant `date`.
 */
export function getTwilightTimes(date: Date, loc: ObserverLocation): TwilightTimes {
  const noon = observingNightStart(date, loc)
  const observer = toObserver(loc)
  const sunset = SearchRiseSet(Body.Sun, observer, -1, noon, 1)?.date ?? null
  const sunrise = SearchRiseSet(Body.Sun, observer, +1, noon, 1)?.date ?? null
  const { civil, nautical, astronomical } = TWILIGHT_ALTITUDE_DEG
  const astronomicalDusk = sunCrossing(-1, noon, loc, astronomical)
  const astronomicalDawn = sunCrossing(+1, noon, loc, astronomical)

  let astronomicalNightMinutes = 0
  if (astronomicalDusk && astronomicalDawn && astronomicalDawn > astronomicalDusk) {
    astronomicalNightMinutes = (astronomicalDawn.getTime() - astronomicalDusk.getTime()) / 60_000
  } else if (!astronomicalDusk && !astronomicalDawn) {
    // Nuit polaire : le Soleil reste sous −18° toute la journée.
    const altAtNoon = getSunGeometricAltitudeDeg(noon, loc)
    astronomicalNightMinutes = altAtNoon < astronomical ? 1440 : 0
  }

  return {
    sunset,
    civilDusk: sunCrossing(-1, noon, loc, civil),
    nauticalDusk: sunCrossing(-1, noon, loc, nautical),
    astronomicalDusk,
    astronomicalDawn,
    nauticalDawn: sunCrossing(+1, noon, loc, nautical),
    civilDawn: sunCrossing(+1, noon, loc, civil),
    sunrise,
    astronomicalNightMinutes,
  }
}

/**
 * Fenêtre d'observation exploitable : nuit astronomique si elle existe, sinon
 * nuit nautique, sinon nuit civile, sinon du coucher au lever (été boréal haut).
 */
export function getDarkWindow(date: Date, loc: ObserverLocation): { start: Date; end: Date } {
  const t = getTwilightTimes(date, loc)
  const pairs: [Date | null, Date | null][] = [
    [t.astronomicalDusk, t.astronomicalDawn],
    [t.nauticalDusk, t.nauticalDawn],
    [t.civilDusk, t.civilDawn],
    [t.sunset, t.sunrise],
  ]
  for (const [start, end] of pairs) if (start && end && end > start) return { start, end }
  const noon = observingNightStart(date, loc)
  return { start: noon, end: new Date(noon.getTime() + MS_PER_DAY) }
}
