import { describe, expect, it } from 'vitest'
import {
  activityWindow,
  computeDeepSkyVisibility,
  estimateLimitingMagnitude,
  expectedHourlyRate,
  getActiveMeteorShowers,
  getUpcomingEvents,
  nearestShowerPeak,
  nextShowerPeak,
  solarLongitudeOfDate,
} from '../astroEngine'
import { DEEP_SKY_CATALOG, METEOR_SHOWERS } from '../../data'
import type { ObserverLocation } from '../../types/astro'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const DALLAS: ObserverLocation = { latitudeDeg: 32.7767, longitudeDeg: -96.797, elevationM: 140 }
const hours = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 3_600_000
const shower = (code: string) => METEOR_SHOWERS.find((s) => s.code === code)!

describe('calendrier des phénomènes', () => {
  it('trouve l’éclipse totale de Soleil du 8 avril 2024 à Dallas', () => {
    const events = getUpcomingEvents(new Date('2024-04-01T00:00:00Z'), 14, DALLAS)
    const eclipse = events.find((e) => e.kind === 'solar-eclipse')
    expect(eclipse?.title).toBe('Éclipse totale de Soleil')
    expect(hours(eclipse!.time, new Date('2024-04-08T18:43:00Z'))).toBeLessThan(0.1)
  })

  it('éclipse totale de Lune du 14 mars 2025 et équinoxe de mars', () => {
    const events = getUpcomingEvents(new Date('2025-03-01T00:00:00Z'), 30, PARIS)
    const lunar = events.find((e) => e.kind === 'lunar-eclipse')
    expect(lunar?.title).toBe('Éclipse totale de Lune')
    expect(hours(lunar!.time, new Date('2025-03-14T06:58:00Z'))).toBeLessThan(0.1)
    const equinox = events.find((e) => e.title === 'Équinoxe de mars')
    expect(hours(equinox!.time, new Date('2025-03-20T09:01:00Z'))).toBeLessThan(0.1)
  })

  it('opposition de Mars le 16 janvier 2025', () => {
    const events = getUpcomingEvents(new Date('2025-01-01T00:00:00Z'), 30, PARIS)
    const opp = events.find((e) => e.kind === 'opposition' && e.bodies[0] === 'Mars')
    expect(hours(opp!.time, new Date('2025-01-16T02:38:00Z'))).toBeLessThan(2)
  })

  it('est trié chronologiquement et sans doublon de phase', () => {
    const events = getUpcomingEvents(new Date('2026-11-18T00:00:00Z'), 60, PARIS)
    for (let i = 1; i < events.length; i++) expect(events[i].time >= events[i - 1].time).toBe(true)
    const phases = events.filter((e) => e.kind === 'moon-phase')
    expect(new Set(phases.map((p) => p.time.getTime())).size).toBe(phases.length)
    expect(phases.length).toBeGreaterThanOrEqual(7)
    expect(events.some((e) => e.title === 'Maximum des Géminides')).toBe(true)
  })
})

describe('essaims météoritiques', () => {
  it('convertit la longitude solaire J2000 vers l’équinoxe de la date', () => {
    // Écliptique vraie de la date : la nutation (≈ −14″ à J2000) est incluse.
    expect(solarLongitudeOfDate(140, new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(140, 2)
    expect(solarLongitudeOfDate(140, new Date('2026-08-12T00:00:00Z'))).toBeCloseTo(140.37, 1)
  })

  it('maximum des Perséides 2024 (IMO : 12 août ~13–16 h UTC)', () => {
    const peak = nearestShowerPeak(shower('PER'), new Date('2024-08-01T00:00:00Z'))
    expect(hours(peak, new Date('2024-08-12T14:30:00Z'))).toBeLessThan(6)
  })

  it('maximum des Géminides 2024 (IMO : 14 décembre ~01 h UTC)', () => {
    const peak = nextShowerPeak(shower('GEM'), new Date('2024-11-01T00:00:00Z'))
    expect(hours(peak, new Date('2024-12-14T01:00:00Z'))).toBeLessThan(6)
  })

  it('fenêtre d’activité à cheval sur deux années (Quadrantides)', () => {
    const peak = nearestShowerPeak(shower('QUA'), new Date('2026-01-03T00:00:00Z'))
    const { from, to } = activityWindow(shower('QUA'), peak)
    expect(from.getUTCFullYear()).toBe(2025)
    expect(from.getUTCMonth()).toBe(11)
    expect(to.getUTCFullYear()).toBe(2026)
    expect(to.getUTCMonth()).toBe(0)
  })

  it('liste les Perséides actives la nuit du maximum', () => {
    const active = getActiveMeteorShowers(new Date('2024-08-12T23:00:00Z'), PARIS)
    const per = active.find((a) => a.code === 'PER')
    expect(per).toBeDefined()
    expect(per!.radiantAltitudeDeg).toBeGreaterThan(30)
    expect(per!.expectedHourlyRate).toBeGreaterThan(10)
    expect(active.every((a) => a.code !== 'GEM')).toBe(true)
  })

  it('modèle de taux observable', () => {
    expect(expectedHourlyRate(100, -5, 2.2, 6.5)).toBe(0)
    expect(expectedHourlyRate(100, 90, 2.2, 6.5)).toBeCloseTo(100, 6)
    expect(expectedHourlyRate(100, 30, 2.2, 6.5)).toBeCloseTo(50, 6)
    expect(estimateLimitingMagnitude(1, -10)).toBe(6.5)
    expect(estimateLimitingMagnitude(1, 90)).toBeCloseTo(4.5, 6)
  })
})

describe('visibilité du ciel profond', () => {
  it('M31 culmine très haut depuis Paris en novembre, Oméga du Centaure jamais visible', () => {
    const vis = computeDeepSkyVisibility(DEEP_SKY_CATALOG, new Date('2026-11-18T21:00:00Z'), PARIS)
    expect(vis.size).toBe(160)
    expect(vis.get('M31')!.maxAltitudeDeg).toBeGreaterThan(80)
    expect(vis.get('M31')!.minutesAbove30Deg).toBeGreaterThan(6 * 60)
    expect(vis.get('NGC5139')!.maxAltitudeDeg).toBeLessThan(0)
    expect(vis.get('NGC5139')!.bestTime).toBeNull()
  })
})
