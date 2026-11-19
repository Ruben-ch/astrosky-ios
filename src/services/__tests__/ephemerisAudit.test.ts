/**
 * Audit de précision astronomique : éphémérides de référence publiées
 * (USNO / NASA GSFC / IMCCE), cas limites (pôles, circumpolaires, ligne de
 * changement de date), réfraction et cohérence avec l'horloge de simulation.
 */
import { Body, Equator, Horizon, Observer, SearchAltitude, SearchMaxElongation, SearchRelativeLongitude, SearchRiseSet } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import {
  getBodyEphemeris,
  getBodyHorizontal,
  getNightTimeline,
  getRiseTransitSet,
  getSunGeometricAltitudeDeg,
  getTwilightTimes,
  getUpcomingEvents,
  observingNightStart,
  phaseForSunAltitude,
  solarLongitudeOfDate,
} from '../astroEngine'
import { fixedRiseTransitSet } from '../astro/fixedObject'
import { createSkyProjector } from '../astro/skyProjector'
import { circumpolarity } from '../catalog/season'
import { createAnchor, jumpTo, simTimeAt, withRate } from '../simulationClock'
import { darkIntervals } from '../satellite/visiblePasses'
import { BRIGHT_STARS } from '../../data'
import type { ObserverLocation } from '../../types/astro'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const minutes = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000
const site = (latitudeDeg: number, longitudeDeg = 0): ObserverLocation => ({ latitudeDeg, longitudeDeg, elevationM: 0 })
const star = (hip: number) => BRIGHT_STARS.find((s) => s.hip === hip)!
const POLARIS = 11767
const CANOPUS = 30438

describe('éphémérides de référence publiées', () => {
  it('saisons 2025 (USNO, ±2 min)', () => {
    const events = getUpcomingEvents(new Date('2025-06-01T00:00:00Z'), 210, PARIS).filter((e) => e.kind === 'season')
    const ref = ['2025-06-21T02:42:00Z', '2025-09-22T18:19:00Z', '2025-12-21T15:03:00Z']
    expect(events).toHaveLength(3)
    events.forEach((e, i) => expect(minutes(e.time, new Date(ref[i]))).toBeLessThan(2))
  })

  it('éclipse totale de Lune du 7 septembre 2025 (NASA : maximum 18 h 12 UTC)', () => {
    const e = getUpcomingEvents(new Date('2025-09-01T00:00:00Z'), 10, PARIS).find((x) => x.kind === 'lunar-eclipse')!
    expect(e.title).toContain('totale')
    expect(minutes(e.time, new Date('2025-09-07T18:11:48Z'))).toBeLessThan(3)
  })

  it('élongations maximales de Vénus 2025 (10 janv. 47,2° E ; 1er juin 45,9° O)', () => {
    const east = SearchMaxElongation(Body.Venus, new Date('2025-01-01T00:00:00Z'))
    expect(east.visibility).toBe('evening')
    expect(east.elongation).toBeCloseTo(47.2, 0)
    expect(east.time.date.toISOString().slice(0, 10)).toBe('2025-01-10')
    const west = SearchMaxElongation(Body.Venus, new Date('2025-05-01T00:00:00Z'))
    expect(west.visibility).toBe('morning')
    expect(west.elongation).toBeCloseTo(45.9, 0)
    expect(west.time.date.toISOString().slice(0, 10)).toBe('2025-06-01')
  })

  it('oppositions : Saturne le 21 sept. 2025, Jupiter le 10 janv. 2026', () => {
    expect(SearchRelativeLongitude(Body.Saturn, 0, new Date('2025-08-01T00:00:00Z')).date.toISOString().slice(0, 10)).toBe('2025-09-21')
    expect(SearchRelativeLongitude(Body.Jupiter, 0, new Date('2025-12-01T00:00:00Z')).date.toISOString().slice(0, 10)).toBe('2026-01-10')
  })
})

describe('réfraction atmosphérique et hauteurs géométriques', () => {
  const observer = new Observer(PARIS.latitudeDeg, PARIS.longitudeDeg, PARIS.elevationM)

  it('au coucher, centre du Soleil à −0,83° géométrique et ≈ −0,27° apparent (bord supérieur sur l’horizon)', () => {
    const set = SearchRiseSet(Body.Sun, observer, -1, new Date('2026-11-18T12:00:00Z'), 1)!
    expect(getSunGeometricAltitudeDeg(set.date, PARIS)).toBeCloseTo(-0.83, 1)
    const apparent = getBodyHorizontal('Sun', set.date, PARIS).altitudeDeg
    expect(apparent).toBeGreaterThan(-0.4)
    expect(apparent).toBeLessThan(-0.15)
  })

  it('les seuils crépusculaires sont comparés en hauteur géométrique (cohérence avec SearchAltitude)', () => {
    for (const [limit, below] of [[-6, 'nautical'], [-12, 'astronomical'], [-18, 'night']] as const) {
      const t = SearchAltitude(Body.Sun, observer, -1, new Date('2026-11-18T12:00:00Z'), 1, limit)!
      expect(getSunGeometricAltitudeDeg(t.date, PARIS)).toBeCloseTo(limit, 3)
      // Une minute après le franchissement, la phase est déjà la suivante.
      expect(phaseForSunAltitude(getSunGeometricAltitudeDeg(new Date(t.date.getTime() + 60_000), PARIS))).toBe(below)
      // La hauteur réfractée, elle, reste ~0,5° au-dessus : ne pas l'utiliser pour les seuils.
      expect(getBodyHorizontal('Sun', t.date, PARIS).altitudeDeg - limit).toBeGreaterThan(0.4)
    }
  })

  it('la réfraction ne fait que relever les astres ; Canopus reste sous l’horizon parisien', () => {
    const date = new Date('2026-11-18T22:00:00Z')
    const project = createSkyProjector(date, PARIS)
    const s = star(CANOPUS)
    const eq = Equator(Body.Sun, date, observer, true, true)
    const geo = Horizon(date, observer, eq.ra, eq.dec).altitude
    const refr = Horizon(date, observer, eq.ra, eq.dec, 'normal').altitude
    expect(refr).toBeGreaterThanOrEqual(geo)
    expect(project(s.raDeg, s.decDeg).altitudeDeg).toBeLessThan(0)
  })
})

describe('astres circumpolaires et jamais levés (SearchRiseSet → null)', () => {
  it('Polaire depuis Paris : ni lever ni coucher, toujours levée, culmine ≈ latitude', () => {
    const p = star(POLARIS)
    const r = fixedRiseTransitSet(p.raDeg, p.decDeg, new Date('2026-11-18T12:00:00Z'), PARIS)
    expect(r.rise).toBeNull()
    expect(r.set).toBeNull()
    expect(r.alwaysUp).toBe(true)
    expect(r.alwaysDown).toBe(false)
    expect(r.transitAltitudeDeg!).toBeGreaterThan(PARIS.latitudeDeg)
    expect(r.transitAltitudeDeg!).toBeLessThan(PARIS.latitudeDeg + 1.5)
    expect(circumpolarity(p.decDeg, PARIS.latitudeDeg)).toEqual({ circumpolar: true, neverRises: false })
  })

  it('Canopus depuis Paris : jamais levée', () => {
    const c = star(CANOPUS)
    const r = fixedRiseTransitSet(c.raDeg, c.decDeg, new Date('2026-11-18T12:00:00Z'), PARIS)
    expect(r.rise).toBeNull()
    expect(r.set).toBeNull()
    expect(r.alwaysDown).toBe(true)
    expect(r.transitAltitudeDeg!).toBeLessThan(0)
    expect(circumpolarity(c.decDeg, PARIS.latitudeDeg)).toEqual({ circumpolar: false, neverRises: true })
  })

  it('Canopus depuis Sydney : lever et coucher normaux', () => {
    const c = star(CANOPUS)
    const r = fixedRiseTransitSet(c.raDeg, c.decDeg, new Date('2026-11-18T00:00:00Z'), { latitudeDeg: -33.87, longitudeDeg: 151.21, elevationM: 0 })
    // −33,87° : Canopus (δ −52,7°) est circumpolaire au-delà de 37,3° S seulement.
    expect(r.rise).not.toBeNull()
    expect(r.set).not.toBeNull()
  })
})

describe('latitudes extrêmes', () => {
  const winter = new Date('2026-12-21T12:00:00Z')

  it.each([90, 89.99, -90, -89.99])('pôle %d° : aucun calcul ne lève d’exception', (lat) => {
    const loc = site(lat, 15)
    expect(() => getNightTimeline(winter, loc)).not.toThrow()
    expect(() => getRiseTransitSet('Moon', winter, loc)).not.toThrow()
    expect(() => darkIntervals(winter, 24, loc)).not.toThrow()
  })

  it('pôle Nord au solstice de décembre : nuit polaire complète', () => {
    const t = getTwilightTimes(winter, site(90))
    expect(t.sunset).toBeNull()
    expect(t.sunrise).toBeNull()
    expect(t.astronomicalNightMinutes).toBe(1440)
    const sun = getRiseTransitSet('Sun', winter, site(90))
    expect(sun.alwaysDown).toBe(true)
    const tl = getNightTimeline(winter, site(90))
    expect(tl.segments).toHaveLength(1)
    expect(tl.segments[0].phase).toBe('night')
  })

  it('pôle Sud au solstice de décembre : jour polaire, aucune nuit', () => {
    const t = getTwilightTimes(winter, site(-90))
    expect(t.astronomicalNightMinutes).toBe(0)
    expect(getRiseTransitSet('Sun', winter, site(-90)).alwaysUp).toBe(true)
    const tl = getNightTimeline(winter, site(-90))
    expect(tl.segments.map((s) => s.phase)).toEqual(['day'])
    expect(darkIntervals(winter, 24, site(-90))).toEqual([])
  })

  it('Svalbard (78,2° N) : nuit polaire civile, Soleil jamais au-dessus de −6°', () => {
    const loc = site(78.22, 15.65)
    const tl = getNightTimeline(winter, loc)
    expect(tl.segments.some((s) => s.phase === 'day' || s.phase === 'civil')).toBe(false)
    const noon = observingNightStart(winter, loc)
    expect(getSunGeometricAltitudeDeg(noon, loc)).toBeLessThan(-6)
  })
})

describe('temps universel, heure locale et horloge de simulation', () => {
  it('midi solaire vrai = 12 h UTC − longitude/15 (± équation du temps ≤ 17 min), quel que soit le fuseau de l’appareil', () => {
    for (const lon of [-179.9, -122.42, 0, 139.69, 179.9]) {
      const noon = observingNightStart(new Date('2026-11-18T23:59:00Z'), site(35, lon))
      const meanNoonMs = Date.UTC(2026, 10, 18, 12) - (lon / 360) * 86_400_000
      const diffMin = (((noon.getTime() - meanNoonMs) / 60_000 + 720) % 1440 + 1440) % 1440 - 720
      // Mi-novembre, le Soleil vrai devance le Soleil moyen d'environ 15 min.
      expect(diffMin).toBeGreaterThan(-17)
      expect(diffMin).toBeLessThan(-13)
    }
  })

  it('ligne de changement de date : ±179,9° donnent la même nuit à 0,4° près', () => {
    const date = new Date('2026-11-18T12:00:00Z')
    const east = getTwilightTimes(date, site(-17, 179.9))
    const west = getTwilightTimes(date, site(-17, -179.9))
    expect(minutes(east.sunset!, west.sunset!)).toBeLessThan(2)
  })

  it('une éphéméride lue via l’horloge accélérée égale le calcul direct à la même date', () => {
    const t0 = Date.UTC(2026, 10, 18, 20)
    let anchor = createAnchor(1_000_000, t0, 1)
    anchor = withRate(anchor, 3600, 1_000_000) // 1 h simulée par seconde réelle
    anchor = jumpTo(anchor, t0, 1_000_000)
    const simMs = simTimeAt(anchor, 1_002_500) // 2,5 s réelles → +2 h 30
    expect(simMs).toBe(t0 + 2.5 * 3_600_000)
    expect(getBodyEphemeris('Moon', new Date(simMs), PARIS)).toEqual(getBodyEphemeris('Moon', new Date('2026-11-18T22:30:00Z'), PARIS))
  })

  it('longitude solaire J2000 → vraie de la date (précession + nutation astronomy-engine)', () => {
    // À J2000, seule la nutation en longitude (≈ −14″) sépare les deux repères.
    expect(Math.abs(solarLongitudeOfDate(140, new Date('2000-01-01T12:00:00Z')) - 140)).toBeLessThan(0.006)
    // 26,6 ans de précession générale (50,29″/an) ≈ +0,37°.
    expect(solarLongitudeOfDate(140, new Date('2026-08-12T00:00:00Z'))).toBeCloseTo(140.37, 1)
  })
})
