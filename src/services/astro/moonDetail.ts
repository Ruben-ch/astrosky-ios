/**
 * Fiche lunaire détaillée : phase, âge, lunaison, lever/coucher de la nuit
 * d'observation et prochaines nouvelle/pleine lune (SearchMoonPhase).
 */
import { Body, Illumination, SearchMoonPhase } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import type { MoonDetail } from '../../types/tonight'
import { getBodyEphemeris } from './bodies'
import { getMoonInfo, previousNewMoon } from './moon'
import { getRiseTransitSet, observingNightStart } from './riseSet'

const MS_PER_DAY = 86_400_000
/** Une lunaison dure 29,27 à 29,83 j : 35 j encadrent toujours l'évènement suivant. */
const SEARCH_LIMIT_DAYS = 35

/** Prochain instant strictement postérieur à `date` où la phase vaut `targetLonDeg`. */
export function nextMoonPhase(targetLonDeg: number, date: Date): Date {
  const t = SearchMoonPhase(targetLonDeg, date, SEARCH_LIMIT_DAYS)
  if (!t) throw new Error(`Phase lunaire ${targetLonDeg}° introuvable`)
  return t.date
}

/** Fraction illuminée échantillonnée de `from` à `to` (inclus) au pas `stepMs`. */
export function illuminationCurve(from: Date, to: Date, stepMs = MS_PER_DAY) {
  const out: { time: Date; illuminatedFraction: number }[] = []
  for (let ms = from.getTime(); ms <= to.getTime() + 1; ms += stepMs) {
    const time = new Date(Math.min(ms, to.getTime()))
    out.push({ time, illuminatedFraction: Illumination(Body.Moon, time).phase_fraction })
  }
  if (out[out.length - 1].time.getTime() !== to.getTime()) {
    out.push({ time: to, illuminatedFraction: Illumination(Body.Moon, to).phase_fraction })
  }
  return out
}

export function getMoonDetail(date: Date, loc: ObserverLocation): MoonDetail {
  const info = getMoonInfo(date)
  const eph = getBodyEphemeris('Moon', date, loc)
  const rs = getRiseTransitSet('Moon', observingNightStart(date, loc), loc)
  const prevNew = previousNewMoon(date)
  const nextNew = nextMoonPhase(0, date)
  const nextFull = nextMoonPhase(180, date)
  return {
    phaseAngleDeg: info.phaseAngleDeg,
    phaseNameFr: info.phaseNameFr,
    illuminatedFraction: info.illuminatedFraction,
    ageDays: info.ageDays,
    lunationDays: (nextNew.getTime() - prevNew.getTime()) / MS_PER_DAY,
    distanceKm: info.distanceKm,
    angularDiameterArcmin: eph.angularDiameterArcsec / 60,
    altitudeDeg: eph.altitudeDeg,
    azimuthDeg: eph.azimuthDeg,
    constellation: eph.constellation,
    rise: rs.rise,
    set: rs.set,
    transit: rs.transit,
    transitAltitudeDeg: rs.transitAltitudeDeg,
    previousNewMoon: prevNew,
    nextNewMoon: nextNew,
    nextFullMoon: nextFull,
    lunationCurve: illuminationCurve(prevNew, nextNew),
  }
}
