/**
 * Essaims météoritiques : instant du maximum (via la longitude solaire,
 * SearchSunLongitude) et taux horaire observable estimé.
 */
import { Ecliptic, MakeTime, RotateVector, Rotation_ECL_EQJ, SearchSunLongitude, Spherical, SunPosition, VectorFromSphere } from 'astronomy-engine'
import type { ActiveMeteorShower, ObserverLocation } from '../../types/astro'
import type { MeteorShower } from '../../types/catalog'
import { METEOR_SHOWERS } from '../../data/meteorShowers'
import { getBodyEphemeris } from './bodies'
import { createSkyProjector } from './skyProjector'

const MS_PER_DAY = 86_400_000

/** Décroissance moyenne de l'activité autour du maximum (profil exponentiel de Jenniskens), dex par degré de λ☉. */
const ACTIVITY_SLOPE_DEX_PER_DEG = 0.25

/** Rotation écliptique J2000 → équateur J2000 (constante, calculée une fois). */
const ECL_TO_EQJ = Rotation_ECL_EQJ()

/**
 * Longitude solaire rapportée à l'écliptique vraie et à l'équinoxe de la date
 * (repère de `SunPosition` / `SearchSunLongitude`) correspondant à une longitude
 * IMO exprimée dans l'écliptique J2000. Précession et nutation : astronomy-engine
 * (`Rotation_ECL_EQJ` puis `Ecliptic`, qui applique EQJ → écliptique vraie de la date).
 */
export function solarLongitudeOfDate(lambdaJ2000Deg: number, date: Date): number {
  const time = MakeTime(date)
  const eclJ2000 = VectorFromSphere(new Spherical(0, lambdaJ2000Deg, 1), time)
  return Ecliptic(RotateVector(ECL_TO_EQJ, eclJ2000)).elon
}

/** Mouvement moyen du Soleil en longitude, en degrés par jour (pour borner la recherche). */
const SUN_MEAN_MOTION_DEG_PER_DAY = 360 / 365.2422
const SEARCH_MARGIN_DAYS = 4

/**
 * Premier instant postérieur à `after` où la longitude apparente du Soleil vaut
 * `lambdaOfDateDeg`. SearchSunLongitude exige un intervalle encadrant le passage :
 * on l'estime d'abord via SunPosition puis on affine sur ±4 jours.
 */
export function searchSunLongitudeAfter(lambdaOfDateDeg: number, after: Date): Date {
  const elon0 = SunPosition(after).elon
  const deltaDeg = (((lambdaOfDateDeg - elon0) % 360) + 360) % 360
  const guessMs = after.getTime() + (deltaDeg / SUN_MEAN_MOTION_DEG_PER_DAY) * MS_PER_DAY
  const fromMs = Math.max(after.getTime(), guessMs - SEARCH_MARGIN_DAYS * MS_PER_DAY)
  const limitDays = (guessMs + SEARCH_MARGIN_DAYS * MS_PER_DAY - fromMs) / MS_PER_DAY
  const t = SearchSunLongitude(lambdaOfDateDeg, new Date(fromMs), limitDays)
  if (!t) throw new Error(`Longitude solaire ${lambdaOfDateDeg}° introuvable`)
  return t.date
}

/** Maximum de l'essaim le plus proche de `date` (dans ±6 mois). */
export function nearestShowerPeak(shower: MeteorShower, date: Date): Date {
  const start = new Date(date.getTime() - 182 * MS_PER_DAY)
  return searchSunLongitudeAfter(solarLongitudeOfDate(shower.peakSolarLongitudeDeg, date), start)
}

/** Prochain maximum strictement postérieur à `date`. */
export function nextShowerPeak(shower: MeteorShower, date: Date): Date {
  return searchSunLongitudeAfter(solarLongitudeOfDate(shower.peakSolarLongitudeDeg, date), date)
}

/** Bornes d'activité de l'essaim encadrant le maximum `peak`. */
export function activityWindow(shower: MeteorShower, peak: Date): { from: Date; to: Date } {
  const y = peak.getUTCFullYear()
  const from = new Date(Date.UTC(y, shower.activeFrom[0] - 1, shower.activeFrom[1]))
  const to = new Date(Date.UTC(y, shower.activeTo[0] - 1, shower.activeTo[1], 23, 59))
  if (from > peak) from.setUTCFullYear(y - 1)
  if (to < peak) to.setUTCFullYear(y + 1)
  return { from, to }
}

/**
 * Magnitude limite visuelle estimée : 6,5 sous ciel noir, dégradée par la Lune
 * proportionnellement à sa fraction illuminée et à sa hauteur.
 */
export function estimateLimitingMagnitude(moonIlluminated: number, moonAltitudeDeg: number): number {
  if (moonAltitudeDeg <= 0) return 6.5
  const elevationFactor = Math.sin((Math.min(moonAltitudeDeg, 90) * Math.PI) / 180)
  return 6.5 - 2.0 * moonIlluminated * Math.sqrt(elevationFactor)
}

/**
 * Taux horaire observable : HR = ZHR(t) × sin(h_radiant) / r^(6,5 − LM).
 * Nul si le radiant est sous l'horizon.
 */
export function expectedHourlyRate(
  zhrAtTime: number,
  radiantAltitudeDeg: number,
  populationIndex: number,
  limitingMagnitude: number,
): number {
  if (radiantAltitudeDeg <= 0) return 0
  const sinH = Math.sin((radiantAltitudeDeg * Math.PI) / 180)
  return (zhrAtTime * sinH) / Math.pow(populationIndex, 6.5 - limitingMagnitude)
}

/** Essaims actifs à `date`, triés par taux observable décroissant. */
export function getActiveMeteorShowers(
  date: Date,
  loc: ObserverLocation,
  showers: readonly MeteorShower[] = METEOR_SHOWERS,
): ActiveMeteorShower[] {
  const project = createSkyProjector(date, loc)
  const moon = getBodyEphemeris('Moon', date, loc)
  const lm = estimateLimitingMagnitude(moon.illuminatedFraction, moon.altitudeDeg)
  const out: ActiveMeteorShower[] = []
  for (const s of showers) {
    const peak = nearestShowerPeak(s, date)
    const { from, to } = activityWindow(s, peak)
    if (date < from || date > to) continue
    const daysFromPeak = (date.getTime() - peak.getTime()) / MS_PER_DAY
    // ~0,9856° de longitude solaire par jour.
    const zhrNow = s.zhr * Math.pow(10, -ACTIVITY_SLOPE_DEX_PER_DEG * Math.abs(daysFromPeak) * 0.9856)
    const radiantAltitudeDeg = project(s.radiantRaDeg, s.radiantDecDeg).altitudeDeg
    out.push({
      code: s.code,
      name: s.name,
      peak,
      daysFromPeak,
      radiantAltitudeDeg,
      expectedHourlyRate: expectedHourlyRate(zhrNow, radiantAltitudeDeg, s.populationIndex, lm),
      zhr: s.zhr,
    })
  }
  return out.sort((a, b) => b.expectedHourlyRate - a.expectedHourlyRate)
}
