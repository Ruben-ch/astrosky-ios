/**
 * Saison idéale d'un objet fixe : visibilité nocturne mois par mois (mi-mois,
 * Soleil sous −12°), date de culmination à minuit solaire et géométrie au
 * méridien. Positions : astronomy-engine (projecteur EQJ→HOR, Equator du Soleil).
 */
import { Body, Equator } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import type { MonthlyVisibility, SeasonInfo } from '../../types/encyclopedia'
import { getSunGeometricAltitudeDeg, toObserver } from '../astro/bodies'
import { createSkyProjector } from '../astro/skyProjector'

const MIN = 60_000
const DAY = 86_400_000
/** Hauteur du Soleil sous laquelle le ciel est jugé assez sombre (fin du crépuscule nautique). */
export const SEASON_SUN_LIMIT_DEG = -12
const STEP_MIN = 20

/** Midi solaire moyen local du 15 du mois `month` (0–11), en UTC. */
function midMonthLocalNoon(year: number, month: number, loc: ObserverLocation): number {
  return Date.UTC(year, month, 15, 12) - (loc.longitudeDeg / 360) * DAY
}

/** Visibilité nocturne de la nuit du 15 au 16 de chaque mois de `year`. */
export function monthlyVisibility(raDeg: number, decDeg: number, year: number, loc: ObserverLocation): MonthlyVisibility[] {
  const out: MonthlyVisibility[] = []
  for (let month = 0; month < 12; month++) {
    const noon = midMonthLocalNoon(year, month, loc)
    let minutes = 0
    let maxAlt = -90
    for (let t = noon; t < noon + DAY; t += STEP_MIN * MIN) {
      const time = new Date(t)
      if (getSunGeometricAltitudeDeg(time, loc) >= SEASON_SUN_LIMIT_DEG) continue
      const alt = createSkyProjector(time, loc)(raDeg, decDeg).altitudeDeg
      if (alt > maxAlt) maxAlt = alt
      if (alt >= 30) minutes += STEP_MIN
    }
    out.push({ month, darkMinutesAbove30: minutes, maxDarkAltitudeDeg: maxAlt })
  }
  return out
}

/** Mois recommandés (≥ 75 % du meilleur), ordonnés dans le sens de la saison (passage d'année géré). */
export function bestMonthsOf(months: readonly MonthlyVisibility[]): number[] {
  const max = Math.max(...months.map((m) => m.darkMinutesAbove30))
  if (max <= 0) return []
  const set = months.filter((m) => m.darkMinutesAbove30 >= 0.75 * max).map((m) => m.month)
  if (set.length === 12) return set
  // Démarre après la plus longue série de mois exclus : « nov. → févr. » reste d'un seul tenant.
  let bestEnd = 0
  let bestLen = 0
  for (let start = 0; start < 12; start++) {
    let len = 0
    while (len < 12 && !set.includes((start + len) % 12)) len++
    if (len > bestLen) {
      bestLen = len
      bestEnd = (start + len) % 12
    }
  }
  return Array.from({ length: 12 }, (_, i) => (bestEnd + i) % 12).filter((m) => set.includes(m))
}

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/**
 * Date de l'année `year` où l'objet passe au méridien à minuit solaire local :
 * l'ascension droite (J2000) du Soleil vaut alors celle de l'objet + 180°.
 */
export function midnightCulminationDate(raDeg: number, year: number, loc: ObserverLocation): Date {
  const observer = toObserver(loc)
  const sunRa = (t: number) => Equator(Body.Sun, new Date(t), observer, false, true).ra * 15
  const t0 = Date.UTC(year, 0, 1)
  let prevT = t0
  let prev = wrap180(sunRa(t0) - (raDeg + 180))
  for (let t = t0 + DAY; t <= Date.UTC(year + 1, 0, 1); t += DAY) {
    const cur = wrap180(sunRa(t) - (raDeg + 180))
    // L'AD solaire croît d'environ 1°/jour : on cherche le passage de − à +.
    if (prev <= 0 && cur > 0 && cur - prev < 10) {
      return new Date(prevT + ((0 - prev) / (cur - prev)) * (t - prevT))
    }
    prev = cur
    prevT = t
  }
  return new Date(t0) // cas limite : passage pile au 1er janvier
}

/** Hauteur géométrique au passage supérieur au méridien, en degrés. */
export function meridianAltitudeDeg(decDeg: number, latitudeDeg: number): number {
  return 90 - Math.abs(latitudeDeg - decDeg)
}

export function circumpolarity(decDeg: number, latitudeDeg: number): { circumpolar: boolean; neverRises: boolean } {
  const polar = Math.abs(decDeg) >= 90 - Math.abs(latitudeDeg)
  return { circumpolar: polar && latitudeDeg * decDeg > 0, neverRises: polar && latitudeDeg * decDeg < 0 }
}

/** Synthèse de saison pour l'année `year` au lieu `loc`. */
export function getSeasonInfo(raDeg: number, decDeg: number, year: number, loc: ObserverLocation): SeasonInfo {
  const months = monthlyVisibility(raDeg, decDeg, year, loc)
  const { circumpolar, neverRises } = circumpolarity(decDeg, loc.latitudeDeg)
  return {
    months,
    bestMonths: bestMonthsOf(months),
    midnightCulmination: neverRises ? null : midnightCulminationDate(raDeg, year, loc),
    meridianAltitudeDeg: meridianAltitudeDeg(decDeg, loc.latitudeDeg),
    circumpolar,
    neverRises,
  }
}
