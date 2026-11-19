import { describe, expect, it } from 'vitest'
import { DefineStar, Body, Equator, Horizon, Observer } from 'astronomy-engine'
import {
  angularDiameterArcsec,
  azimuthToCardinal,
  createSkyProjector,
  getAltitudeCurve,
  getBodyEphemeris,
  getDarkWindow,
  getMoonInfo,
  getNightSummary,
  getRiseTransitSet,
  getSolarSystemEphemerides,
  getTwilightTimes,
  observingNightStart,
  phaseNameFromAngle,
  previousNewMoon,
} from '../astroEngine'
import type { ObserverLocation } from '../../types/astro'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const TROMSO: ObserverLocation = { latitudeDeg: 69.6492, longitudeDeg: 18.9553, elevationM: 10 }
const minutes = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000

describe('éphémérides du système solaire', () => {
  it('produit une éphéméride cohérente pour chaque astre', () => {
    const date = new Date('2026-11-18T21:00:00Z')
    const all = getSolarSystemEphemerides(date, PARIS)
    expect(all.map((b) => b.id)).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'])
    for (const b of all) {
      expect(b.raHours).toBeGreaterThanOrEqual(0)
      expect(b.raHours).toBeLessThan(24)
      expect(Math.abs(b.decDeg)).toBeLessThanOrEqual(90)
      expect(b.azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(b.azimuthDeg).toBeLessThan(360)
      expect(b.illuminatedFraction).toBeGreaterThanOrEqual(0)
      expect(b.illuminatedFraction).toBeLessThanOrEqual(1)
      expect(b.constellation).toMatch(/^[A-Z][A-Za-z]{2}$/)
    }
    const sun = all[0]
    expect(sun.altitudeDeg).toBeLessThan(-18) // 21 h UTC en novembre à Paris
    expect(sun.magnitude).toBeLessThan(-26)
    expect(sun.angularDiameterArcsec / 60).toBeGreaterThan(32) // ~32,4′ en novembre
  })

  it('diamètre apparent de la Lune ≈ 29–34′', () => {
    const moon = getBodyEphemeris('Moon', new Date('2026-11-18T21:00:00Z'), PARIS)
    expect(moon.angularDiameterArcsec / 60).toBeGreaterThan(29)
    expect(moon.angularDiameterArcsec / 60).toBeLessThan(34)
    expect(angularDiameterArcsec('Jupiter', 4.2)).toBeCloseTo(46.9, 0)
  })
})

describe('lever / coucher / crépuscules', () => {
  it('lever et coucher du Soleil au solstice à Paris (référence IMCCE ±2 min)', () => {
    const start = new Date('2024-06-20T12:00:00Z')
    const rts = getRiseTransitSet('Sun', start, PARIS)
    expect(minutes(rts.set!, new Date('2024-06-20T19:58:00Z'))).toBeLessThan(2)
    expect(minutes(rts.rise!, new Date('2024-06-21T03:47:00Z'))).toBeLessThan(2)
    expect(rts.transitAltitudeDeg!).toBeCloseTo(90 - 48.8566 + 23.44, 0)
  })

  it('ordonne les crépuscules de la nuit d’observation', () => {
    const t = getTwilightTimes(new Date('2026-11-18T22:00:00Z'), PARIS)
    const seq = [t.sunset, t.civilDusk, t.nauticalDusk, t.astronomicalDusk, t.astronomicalDawn, t.nauticalDawn, t.civilDawn, t.sunrise]
    seq.forEach((d) => expect(d).toBeInstanceOf(Date))
    for (let i = 1; i < seq.length; i++) expect(seq[i]!.getTime()).toBeGreaterThan(seq[i - 1]!.getTime())
    expect(t.astronomicalNightMinutes).toBeGreaterThan(10 * 60)
  })

  it('le midi solaire vrai précède la date et encadre la nuit', () => {
    const d = new Date('2026-11-19T02:00:00Z')
    const noon = observingNightStart(d, PARIS)
    expect(noon < d).toBe(true)
    expect(d.getTime() - noon.getTime()).toBeLessThan(24 * 3_600_000)
    expect(noon.getUTCHours()).toBe(11) // ~11 h 36 UTC à Paris en novembre
  })

  it('gère le soleil de minuit (Tromsø en juin)', () => {
    const d = new Date('2026-06-21T00:00:00Z')
    const t = getTwilightTimes(d, TROMSO)
    expect(t.sunset).toBeNull()
    expect(t.astronomicalNightMinutes).toBe(0)
    const rts = getRiseTransitSet('Sun', observingNightStart(d, TROMSO), TROMSO)
    expect(rts.alwaysUp).toBe(true)
    const win = getDarkWindow(d, TROMSO)
    expect(win.end.getTime() - win.start.getTime()).toBeCloseTo(24 * 3_600_000, -5)
  })
})

describe('Lune', () => {
  it('pleine lune du 23 avril 2024 à 23 h 49 UTC', () => {
    const m = getMoonInfo(new Date('2024-04-23T23:49:00Z'))
    expect(m.phaseName).toBe('full')
    expect(m.illuminatedFraction).toBeGreaterThan(0.99)
    expect(m.ageDays).toBeCloseTo(15.2, 0)
  })

  it('nouvelle lune de l’éclipse du 8 avril 2024', () => {
    const nm = previousNewMoon(new Date('2024-04-10T00:00:00Z'))
    expect(minutes(nm, new Date('2024-04-08T18:21:00Z'))).toBeLessThan(3)
    const m = getMoonInfo(new Date('2024-04-01T00:00:00Z'))
    expect(m.nextQuarters).toHaveLength(4)
    expect(m.nextQuarters.map((q) => q.quarter)).toEqual([3, 0, 1, 2]) // dernier quartier le 2 avril 2024
    expect(minutes(m.nextQuarters[1].time, nm)).toBeLessThan(1)
    expect(m.distanceKm).toBeGreaterThan(356_000)
    expect(m.distanceKm).toBeLessThan(407_000)
  })

  it('nomme les phases', () => {
    expect(phaseNameFromAngle(2)).toBe('new')
    expect(phaseNameFromAngle(355)).toBe('new')
    expect(phaseNameFromAngle(45)).toBe('waxing-crescent')
    expect(phaseNameFromAngle(92)).toBe('first-quarter')
    expect(phaseNameFromAngle(135)).toBe('waxing-gibbous')
    expect(phaseNameFromAngle(185)).toBe('full')
    expect(phaseNameFromAngle(220)).toBe('waning-gibbous')
    expect(phaseNameFromAngle(268)).toBe('third-quarter')
    expect(phaseNameFromAngle(300)).toBe('waning-crescent')
  })
})

describe('projection des objets fixes', () => {
  it('concorde avec Equator+Horizon d’astronomy-engine à 0,01° près', () => {
    const date = new Date('2026-11-18T23:00:00Z')
    const project = createSkyProjector(date, PARIS)
    // Bételgeuse J2000 : 88,7929°, +7,4071°
    DefineStar(Body.Star1, 88.7929 / 15, 7.4071, 548)
    const obs = new Observer(PARIS.latitudeDeg, PARIS.longitudeDeg, PARIS.elevationM)
    const eq = Equator(Body.Star1, date, obs, true, true)
    const ref = Horizon(date, obs, eq.ra, eq.dec, 'normal')
    const mine = project(88.7929, 7.4071)
    expect(Math.abs(mine.altitudeDeg - ref.altitude)).toBeLessThan(0.01)
    expect(Math.abs(mine.azimuthDeg - ref.azimuth)).toBeLessThan(0.01)
  })

  it('l’étoile Polaire culmine à la latitude du lieu (±1°)', () => {
    const polaris = createSkyProjector(new Date('2026-11-18T22:00:00Z'), PARIS)(37.9546, 89.2641)
    expect(Math.abs(polaris.altitudeDeg - PARIS.latitudeDeg)).toBeLessThan(1)
  })

  it('courbe de hauteur échantillonnée', () => {
    const curve = getAltitudeCurve({ kind: 'body', id: 'Moon' }, new Date('2026-11-18T12:00:00Z'), 24 * 3_600_000, 15 * 60_000, PARIS)
    expect(curve).toHaveLength(97)
    expect(curve.some((s) => s.altitudeDeg > 0)).toBe(true)
    expect(() => getAltitudeCurve({ kind: 'body', id: 'Sun' }, new Date(), 1000, 0, PARIS)).toThrow(RangeError)
  })

  it('points cardinaux', () => {
    expect(azimuthToCardinal(0)).toBe('N')
    expect(azimuthToCardinal(359)).toBe('N')
    expect(azimuthToCardinal(90)).toBe('E')
    expect(azimuthToCardinal(202.5)).toBe('SSO')
    expect(azimuthToCardinal(270)).toBe('O')
  })
})

describe('synthèse de nuit', () => {
  it('assemble crépuscules, Lune, astres et levers', () => {
    const s = getNightSummary(new Date('2026-11-18T21:00:00Z'), PARIS)
    expect(Object.keys(s.riseSet)).toHaveLength(9)
    expect(s.bodies).toHaveLength(9)
    expect(s.twilight.astronomicalDusk).toBeInstanceOf(Date)
    expect(s.moon.phaseNameFr.length).toBeGreaterThan(0)
  })
})
