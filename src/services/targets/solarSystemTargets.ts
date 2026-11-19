/**
 * Volet « système solaire » du classement : planètes (fenêtre crépuscule civil
 * → aube civile, Mercure et Vénus étant des astres du crépuscule) et Lune.
 */
import { Equator } from 'astronomy-engine'
import type { ObserverLocation, SolarSystemBodyId } from '../../types/astro'
import type { InstrumentId, InstrumentProfile, Interval, RankedTarget, TargetTag } from '../../types/tonight'
import { PLANETS, getBodyEphemeris, getBodyHorizontal, toEngineBody, toObserver } from '../astro/bodies'
import { estimateLimitingMagnitude } from '../astro/meteors'
import { stellarLimitingMagnitude } from './instruments'
import { altitudeScore, altitudeStats, clamp01, sampleWindow } from './sampling'

export const MIN_PLANET_ALTITUDE_DEG = 8

/**
 * Intérêt visuel relatif de chaque astre selon l'instrument (0–1) : disque et
 * détails au télescope, satellites galiléens aux jumelles, éclat à l'œil nu.
 */
const INTEREST: Readonly<Record<InstrumentId, Readonly<Partial<Record<SolarSystemBodyId, number>>>>> = {
  'naked-eye': { Venus: 0.95, Jupiter: 0.95, Mars: 0.85, Saturn: 0.8, Mercury: 0.75, Uranus: 0.35, Moon: 0.8 },
  binoculars: { Jupiter: 0.95, Moon: 0.9, Saturn: 0.8, Venus: 0.75, Mars: 0.7, Mercury: 0.6, Uranus: 0.6, Neptune: 0.5 },
  telescope: { Jupiter: 1, Saturn: 1, Moon: 0.95, Mars: 0.9, Venus: 0.8, Mercury: 0.6, Uranus: 0.55, Neptune: 0.5 },
}

export function rankSolarSystem(
  loc: ObserverLocation,
  profile: InstrumentProfile,
  planetWin: Interval,
  darkWin: Interval,
  stepMinutes: number,
  moonIllum: number,
  separation: (raDeg: number, decDeg: number) => number,
): RankedTarget[] {
  const samples = sampleWindow(planetWin.start, planetWin.end, stepMinutes, loc)
  const out: RankedTarget[] = []
  for (const id of [...PLANETS, 'Moon'] as SolarSystemBodyId[]) {
    const interest = INTEREST[profile.id][id]
    if (interest === undefined) continue
    const alts = id === 'Moon' ? samples.moonAltitudeDeg : samples.times.map((t) => getBodyHorizontal(id, t, loc).altitudeDeg)
    const stats = altitudeStats(alts, stepMinutes)
    if (stats.maxAltitudeDeg < MIN_PLANET_ALTITUDE_DEG) continue
    const best = samples.times[stats.bestIndex]
    const eph = getBodyEphemeris(id, best, loc)
    const tags: TargetTag[] = []
    let score: number
    let sepDeg = 0
    if (id === 'Moon') {
      if (eph.illuminatedFraction < 0.03) continue
      // Le terminateur (relief rasant) est plus spectaculaire hors pleine lune.
      const terminator = 0.7 + 0.3 * Math.abs(Math.sin((eph.elongationDeg * Math.PI) / 180))
      score = 100 * interest * terminator * altitudeScore(stats.maxAltitudeDeg, stats.minutesAbove30Deg) ** 0.6
    } else {
      const nelm = estimateLimitingMagnitude(moonIllum, samples.moonAltitudeDeg[stats.bestIndex])
      const limit = stellarLimitingMagnitude(profile, nelm) - 0.5
      if (eph.magnitude > limit) continue
      const j2000 = Equator(toEngineBody(id), best, toObserver(loc), false, true)
      sepDeg = separation(j2000.ra * 15, j2000.dec)
      const magScore = 0.3 + 0.7 * clamp01((limit - eph.magnitude) / 6)
      score = 100 * interest * magScore * altitudeScore(stats.maxAltitudeDeg, stats.minutesAbove30Deg) ** 0.7
      if (limit - eph.magnitude >= 3) tags.push('bright')
      // Astre du crépuscule : jamais à plus de 10° pendant la fenêtre sombre.
      const darkMax = Math.max(-90, ...alts.filter((_, i) => samples.times[i] >= darkWin.start && samples.times[i] <= darkWin.end))
      if (darkMax < 10) tags.push('twilight')
    }
    if (stats.maxAltitudeDeg >= 60) tags.unshift('high')
    if (stats.minutesAbove30Deg >= 240) tags.push('long-window')
    out.push({
      key: id, kind: id === 'Moon' ? 'moon' : 'planet', code: eph.nameFr, name: eph.nameFr,
      typeLabel: id === 'Moon' ? 'Satellite naturel' : 'Planète', deepSkyType: null, bodyId: id,
      constellation: eph.constellation, magnitude: eph.magnitude, score: Math.round(score),
      maxAltitudeDeg: stats.maxAltitudeDeg, bestTime: best, minutesAbove30Deg: stats.minutesAbove30Deg,
      moonSeparationDeg: sepDeg, tags,
    })
  }
  return out
}
