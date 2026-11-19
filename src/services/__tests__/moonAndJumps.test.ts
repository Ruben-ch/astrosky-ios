import { Body, Illumination, MoonPhase } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { getMoonDetail, getTimeJumps, illuminationCurve, nextMoonPhase } from '../astroEngine'
import { MS_PER_DAY, shiftCalendar } from '../simulationClock'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const DATE = new Date('2026-11-18T21:00:00Z')

describe('fiche lunaire', () => {
  const m = getMoonDetail(DATE, PARIS)

  it('prochaines pleine et nouvelle lune exactes et postérieures', () => {
    expect(m.nextFullMoon > DATE && m.nextNewMoon > DATE).toBe(true)
    expect(Illumination(Body.Moon, m.nextFullMoon).phase_fraction).toBeGreaterThan(0.99)
    expect(Illumination(Body.Moon, m.nextNewMoon).phase_fraction).toBeLessThan(0.01)
    expect(Math.abs(((MoonPhase(m.nextFullMoon) - 180 + 540) % 360) - 180)).toBeLessThan(0.01)
  })

  it('lunaison synodique et âge cohérents', () => {
    expect(m.lunationDays).toBeGreaterThan(29.2)
    expect(m.lunationDays).toBeLessThan(29.9)
    expect(m.ageDays).toBeCloseTo((DATE.getTime() - m.previousNewMoon.getTime()) / MS_PER_DAY, 6)
    expect(m.ageDays).toBeLessThan(m.lunationDays)
  })

  it('courbe d’illumination : 0 aux nouvelles lunes, ~1 au milieu', () => {
    const c = m.lunationCurve
    expect(c[0].time.getTime()).toBe(m.previousNewMoon.getTime())
    expect(c.at(-1)!.time.getTime()).toBe(m.nextNewMoon.getTime())
    expect(c[0].illuminatedFraction).toBeLessThan(0.01)
    expect(Math.max(...c.map((p) => p.illuminatedFraction))).toBeGreaterThan(0.98)
  })

  it('données géométriques plausibles', () => {
    expect(m.distanceKm).toBeGreaterThan(356_000)
    expect(m.distanceKm).toBeLessThan(407_000)
    expect(m.angularDiameterArcmin).toBeGreaterThan(29)
    expect(m.angularDiameterArcmin).toBeLessThan(34)
    expect(m.illuminatedFraction).toBeGreaterThan(0.5)
  })

  it('recherche de phase bornée et courbe à pas fixe', () => {
    const q = nextMoonPhase(90, DATE)
    expect(q.getTime() - DATE.getTime()).toBeLessThan(30 * MS_PER_DAY)
    const curve = illuminationCurve(DATE, new Date(DATE.getTime() + 2.5 * MS_PER_DAY))
    expect(curve).toHaveLength(4)
  })
})

describe('sauts temporels', () => {
  const jumps = getTimeJumps(DATE, PARIS)

  it('renvoie les 9 évènements, triés et postérieurs', () => {
    expect(new Set(jumps.map((j) => j.id)).size).toBe(9)
    for (let i = 0; i < jumps.length; i++) {
      expect(jumps[i].time > DATE).toBe(true)
      if (i > 0) expect(jumps[i].time >= jumps[i - 1].time).toBe(true)
    }
  })

  it('un second appui vise l’occurrence suivante', () => {
    const sunrise = jumps.find((j) => j.id === 'sunrise')!
    const again = getTimeJumps(sunrise.time, PARIS).find((j) => j.id === 'sunrise')!
    const gapH = (again.time.getTime() - sunrise.time.getTime()) / 3_600_000
    expect(gapH).toBeGreaterThan(23.5)
    expect(gapH).toBeLessThan(24.5)
  })

  it('omet les évènements impossibles (soleil de minuit)', () => {
    const ids = getTimeJumps(new Date('2026-06-21T12:00:00Z'), { latitudeDeg: 78.22, longitudeDeg: 15.65, elevationM: 0 }).map((j) => j.id)
    expect(ids).not.toContain('sunset')
    expect(ids).toContain('full-moon')
  })
})

describe('pas calendaires', () => {
  const base = new Date(2026, 0, 31, 22, 30).getTime()
  it('mois : borne au dernier jour et conserve l’heure murale', () => {
    const d = new Date(shiftCalendar(base, 'month', 1))
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([1, 28, 22, 30])
    expect(new Date(shiftCalendar(base, 'month', -2)).getMonth()).toBe(10)
  })
  it('année, semaine, heure, minute', () => {
    expect(new Date(shiftCalendar(new Date(2028, 1, 29).getTime(), 'year', 1)).getDate()).toBe(28)
    expect(shiftCalendar(base, 'week', 1) - base).toBe(7 * MS_PER_DAY)
    expect(shiftCalendar(base, 'hour', -3) - base).toBe(-3 * 3_600_000)
    expect(shiftCalendar(base, 'minute', 10) - base).toBe(600_000)
  })
})
