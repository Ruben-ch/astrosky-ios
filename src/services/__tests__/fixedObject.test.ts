import { describe, expect, it } from 'vitest'
import { createSkyProjector } from '../astroEngine'
import { fixedRiseTransitSet } from '../astro/fixedObject'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const START = new Date('2026-11-18T12:00:00Z')

describe('lever / culmination / coucher d’objets fixes', () => {
  it('Bételgeuse : lever et coucher à hauteur apparente ≈ 0°', () => {
    const rs = fixedRiseTransitSet(88.79, 7.41, START, PARIS)
    for (const t of [rs.rise!, rs.set!]) {
      expect(t).toBeInstanceOf(Date)
      // SearchRiseSet vise le centre à −réfraction : hauteur réfractée proche de 0.
      expect(Math.abs(createSkyProjector(t, PARIS)(88.79, 7.41).altitudeDeg)).toBeLessThan(0.6)
    }
  })

  it('culmination à 90° − |φ − δ|', () => {
    const rs = fixedRiseTransitSet(10.68, 41.27, START, PARIS) // M31
    expect(rs.transitAltitudeDeg!).toBeCloseTo(90 - Math.abs(48.8566 - 41.27), 0)
    expect(rs.transit!.getTime() - START.getTime()).toBeLessThanOrEqual(86_400_000)
  })

  it('Polaire circumpolaire, Canopus jamais levé depuis Paris', () => {
    expect(fixedRiseTransitSet(37.95, 89.26, START, PARIS).alwaysUp).toBe(true)
    const canopus = fixedRiseTransitSet(95.99, -52.7, START, PARIS)
    expect(canopus.alwaysDown).toBe(true)
    expect(canopus.rise).toBeNull()
  })
})
