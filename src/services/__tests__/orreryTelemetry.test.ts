import { MakeTime } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { ORRERY_BODIES } from '../../data/solarSystemPhysical'
import { angularDiameterArcsec, axialTiltDeg, getOrreryTelemetry, isGalileanMoon } from '../orrery/telemetry'

const DATE = new Date('2026-11-18T21:00:00Z')

describe('télémétrie', () => {
  it('produit des valeurs finies ou nulles pour chaque astre', () => {
    for (const id of ORRERY_BODIES) {
      const t = getOrreryTelemetry(id, DATE)
      expect(t.id).toBe(id)
      for (const [k, v] of Object.entries(t)) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${id}.${k}`).toBe(true)
      }
    }
  })

  it('Soleil : distance à la Terre, magnitude et diamètre apparent', () => {
    const t = getOrreryTelemetry('Sun', DATE)
    expect(t.kind).toBe('star')
    expect(t.sunDistanceAu).toBeNull()
    expect(t.earthDistanceAu!).toBeGreaterThan(0.983)
    expect(t.earthDistanceAu!).toBeLessThan(0.992)
    expect(t.magnitude!).toBeCloseTo(-26.7, 0)
    // Mi-novembre : ≈ 32′ 24″.
    expect(t.angularDiameterArcsec! / 60).toBeCloseTo(32.4, 0)
    expect(t.lightTimeMin!).toBeCloseTo(8.2, 0)
    expect(t.axialTiltDeg!).toBeCloseTo(7.25, 1)
  })

  it('Terre : distance au Soleil, pas de distance à elle-même', () => {
    const t = getOrreryTelemetry('Earth', DATE)
    expect(t.earthDistanceAu).toBeNull()
    expect(t.sunDistanceAu!).toBeCloseTo(0.988, 2)
    expect(t.orbitalPeriodDays!).toBeCloseTo(365.26, 1)
    expect(t.axialTiltDeg!).toBeCloseTo(23.44, 1)
  })

  it('Jupiter : magnitude, diamètre et phase plausibles', () => {
    const t = getOrreryTelemetry('Jupiter', DATE)
    expect(t.magnitude!).toBeGreaterThan(-3)
    expect(t.magnitude!).toBeLessThan(-1.5)
    expect(t.angularDiameterArcsec!).toBeGreaterThan(29)
    expect(t.angularDiameterArcsec!).toBeLessThan(51)
    expect(t.phaseFraction!).toBeGreaterThan(0.98)
    expect(t.elongationDeg!).toBeGreaterThan(0)
    expect(t.elongationDeg!).toBeLessThanOrEqual(180)
    expect(['morning', 'evening']).toContain(t.visibility)
    expect(t.orbitalPeriodDays! / 365.25).toBeCloseTo(11.86, 1)
  })

  it('Vénus : phase variable et élongation ≤ 47,8°', () => {
    const t = getOrreryTelemetry('Venus', DATE)
    expect(t.elongationDeg!).toBeLessThan(47.8)
    expect(t.phaseFraction!).toBeGreaterThanOrEqual(0)
    expect(t.phaseFraction!).toBeLessThanOrEqual(1)
    expect(t.earthDistanceAu!).toBeGreaterThan(0.26)
    expect(t.earthDistanceAu!).toBeLessThan(1.74)
  })

  it('Saturne : inclinaison des anneaux renseignée', () => {
    const t = getOrreryTelemetry('Saturn', DATE)
    expect(t.ringTiltDeg).not.toBeNull()
    expect(t.ringTiltDeg!).toBeLessThan(27.5)
    expect(getOrreryTelemetry('Mars', DATE).ringTiltDeg).toBeNull()
  })

  it('obliquités vraies, rotateurs rétrogrades compris', () => {
    const t = MakeTime(DATE)
    expect(axialTiltDeg('Mars', t)).toBeCloseTo(25.2, 0)
    expect(axialTiltDeg('Saturn', t)).toBeCloseTo(26.7, 0)
    expect(axialTiltDeg('Uranus', t)).toBeCloseTo(97.8, 0)
    expect(axialTiltDeg('Venus', t)).toBeCloseTo(177.4, 0)
    expect(axialTiltDeg('Jupiter', t)).toBeCloseTo(3.1, 0)
    expect(axialTiltDeg('Neptune', t)).toBeCloseTo(28.3, 0)
  })

  it('lunes galiléennes : proches de Jupiter dans le ciel, même élongation', () => {
    const jup = getOrreryTelemetry('Jupiter', DATE)
    for (const id of ['Io', 'Europa', 'Ganymede', 'Callisto'] as const) {
      expect(isGalileanMoon(id)).toBe(true)
      const t = getOrreryTelemetry(id, DATE)
      expect(t.kind).toBe('moon')
      expect(t.magnitude).toBeNull()
      expect(Math.abs(t.earthDistanceAu! - jup.earthDistanceAu!)).toBeLessThan(0.02)
      expect(Math.abs(t.elongationDeg! - jup.elongationDeg!)).toBeLessThan(0.2)
      expect(t.jupiterSeparationArcsec!).toBeLessThan(700)
      expect(t.angularDiameterArcsec!).toBeGreaterThan(0.8)
      expect(t.angularDiameterArcsec!).toBeLessThan(2)
      expect(t.visibility).toBe(jup.visibility)
    }
    expect(isGalileanMoon('Jupiter')).toBe(false)
  })

  it('diamètre apparent : Soleil à 1 UA ≈ 1919″', () => {
    expect(angularDiameterArcsec('Sun', 1)).toBeCloseTo(1919, -1)
  })
})
