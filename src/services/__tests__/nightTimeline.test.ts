import { describe, expect, it } from 'vitest'
import {
  getBodyHorizontal,
  getNightTimeline,
  intervalMinutes,
  moonUpIntervals,
  nextTransition,
  phaseForSunAltitude,
  segmentAt,
  subtractIntervals,
} from '../astroEngine'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const TROMSO = { latitudeDeg: 69.6496, longitudeDeg: 18.956, elevationM: 10 }
const d = (iso: string) => new Date(iso)
const iv = (a: string, b: string) => ({ start: d(a), end: d(b) })

describe('phases crépusculaires', () => {
  it('classe la hauteur du Soleil', () => {
    expect(phaseForSunAltitude(10)).toBe('day')
    expect(phaseForSunAltitude(-3)).toBe('civil')
    expect(phaseForSunAltitude(-9)).toBe('nautical')
    expect(phaseForSunAltitude(-15)).toBe('astronomical')
    expect(phaseForSunAltitude(-25)).toBe('night')
  })
})

describe('frise de la nuit (Paris, 18 nov. 2026)', () => {
  const tl = getNightTimeline(d('2026-11-18T21:00:00Z'), PARIS)

  it('couvre midi → midi sans trou ni chevauchement', () => {
    expect(tl.segments[0].start.getTime()).toBe(tl.start.getTime())
    expect(tl.segments.at(-1)!.end.getTime()).toBe(tl.end.getTime())
    for (let i = 1; i < tl.segments.length; i++) expect(tl.segments[i].start.getTime()).toBe(tl.segments[i - 1].end.getTime())
    const spanH = (tl.end.getTime() - tl.start.getTime()) / 3_600_000
    expect(spanH).toBeGreaterThan(23.9)
    expect(spanH).toBeLessThan(24.1)
  })

  it('enchaîne les 9 phases symétriques jour → nuit → jour', () => {
    expect(tl.segments.map((s) => s.phase)).toEqual(['day', 'civil', 'nautical', 'astronomical', 'night', 'astronomical', 'nautical', 'civil', 'day'])
    expect(tl.transitions).toHaveLength(8)
    expect(tl.transitions.filter((t) => t.evening)).toHaveLength(4)
  })

  it('chaque segment correspond à la hauteur réelle du Soleil en son milieu', () => {
    for (const s of tl.segments) {
      const mid = new Date((s.start.getTime() + s.end.getTime()) / 2)
      expect(phaseForSunAltitude(getBodyHorizontal('Sun', mid, PARIS).altitudeDeg), s.phase).toBe(s.phase)
    }
  })

  it('la nuit noire sans Lune est incluse dans la nuit et hors présence lunaire', () => {
    const night = tl.segments.find((s) => s.phase === 'night')!
    expect(tl.moonlessDark.length).toBeGreaterThan(0)
    for (const m of tl.moonlessDark) {
      expect(m.start >= night.start && m.end <= night.end).toBe(true)
      for (const up of tl.moonUp) expect(m.end <= up.start || m.start >= up.end).toBe(true)
    }
    expect(tl.moonlessDarkMinutes).toBeCloseTo(intervalMinutes(tl.moonlessDark), 6)
  })

  it('les intervalles lunaires sont cohérents avec la hauteur de la Lune', () => {
    for (const up of tl.moonUp) {
      const mid = new Date((up.start.getTime() + up.end.getTime()) / 2)
      expect(getBodyHorizontal('Moon', mid, PARIS).altitudeDeg).toBeGreaterThan(0)
    }
  })

  it('segment courant et prochaine transition', () => {
    const at = d('2026-11-18T21:00:00Z')
    expect(segmentAt(tl, at)?.phase).toBe('night')
    expect(nextTransition(tl, at)?.label).toBe('Aube astronomique')
    expect(segmentAt(tl, d('2030-01-01T00:00:00Z'))).toBeNull()
  })
})

describe('latitudes extrêmes (Tromsø)', () => {
  it('soleil de minuit : un seul segment de jour', () => {
    const tl = getNightTimeline(d('2026-06-21T22:00:00Z'), TROMSO)
    expect(tl.segments.map((s) => s.phase)).toEqual(['day'])
    expect(tl.moonlessDarkMinutes).toBe(0)
  })

  it('nuit polaire : pas de jour, nuit noire présente', () => {
    const phases = getNightTimeline(d('2026-12-21T22:00:00Z'), TROMSO).segments.map((s) => s.phase)
    expect(phases).not.toContain('day')
    expect(phases).toContain('night')
  })
})

describe('opérations sur intervalles', () => {
  it('soustrait des intervalles', () => {
    const base = [iv('2026-01-01T18:00:00Z', '2026-01-02T06:00:00Z')]
    const minus = [iv('2026-01-01T12:00:00Z', '2026-01-01T20:00:00Z'), iv('2026-01-02T01:00:00Z', '2026-01-02T02:00:00Z')]
    const res = subtractIntervals(base, minus)
    expect(res.map((r) => [r.start.toISOString(), r.end.toISOString()])).toEqual([
      ['2026-01-01T20:00:00.000Z', '2026-01-02T01:00:00.000Z'],
      ['2026-01-02T02:00:00.000Z', '2026-01-02T06:00:00.000Z'],
    ])
    expect(intervalMinutes(res)).toBe(540)
    expect(subtractIntervals(base, [iv('2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z')])).toEqual([])
  })

  it('détecte une Lune levée sur toute la fenêtre', () => {
    // 1 h autour du passage au méridien de la Lune : aucun lever/coucher.
    const res = moonUpIntervals(d('2026-11-18T17:00:00Z'), d('2026-11-18T18:00:00Z'), PARIS)
    expect(res).toHaveLength(1)
    expect(res[0].start.toISOString()).toBe('2026-11-18T17:00:00.000Z')
  })
})
