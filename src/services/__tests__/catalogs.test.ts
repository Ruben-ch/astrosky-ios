import { describe, expect, it } from 'vitest'
import { Constellation } from 'astronomy-engine'
import {
  BRIGHT_STARS,
  CONSTELLATION_FIGURES,
  DEEP_SKY_CATALOG,
  DEEP_SKY_TYPE_LABEL_FR,
  MESSIER_CATALOG,
  METEOR_SHOWERS,
  NGC_IC_CATALOG,
  deepSkyLabel,
} from '../../data'

const inRange = (raDeg: number, decDeg: number) => raDeg >= 0 && raDeg < 360 && decDeg >= -90 && decDeg <= 90

describe('catalogues statiques', () => {
  it('contient les 110 objets Messier, numérotés 1 à 110', () => {
    expect(MESSIER_CATALOG).toHaveLength(110)
    expect(MESSIER_CATALOG.map((o) => o.messier)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1))
    const m31 = MESSIER_CATALOG[30]
    expect(m31).toMatchObject({ id: 'M31', ngc: 'NGC 224', type: 'galaxy', constellation: 'And' })
    expect(m31.raDeg).toBeCloseTo(10.68, 1)
    expect(m31.decDeg).toBeCloseTo(41.27, 1)
    expect(MESSIER_CATALOG[41]).toMatchObject({ id: 'M42', constellation: 'Ori' })
    expect(MESSIER_CATALOG[44]).toMatchObject({ id: 'M45', name: 'Pléiades', constellation: 'Tau' })
  })

  it('contient 50 objets NGC/IC majeurs hors Messier', () => {
    expect(NGC_IC_CATALOG).toHaveLength(50)
    expect(NGC_IC_CATALOG.every((o) => o.messier === null && /^(NGC|IC) \d+$/.test(o.ngc ?? ''))).toBe(true)
    const ids = DEEP_SKY_CATALOG.map((o) => o.id)
    expect(new Set(ids).size).toBe(160)
  })

  it('coordonnées, types et constellations valides (vérifiées par astronomy-engine)', () => {
    for (const o of DEEP_SKY_CATALOG) {
      expect(inRange(o.raDeg, o.decDeg)).toBe(true)
      expect(DEEP_SKY_TYPE_LABEL_FR[o.type]).toBeDefined()
      expect(Constellation(o.raDeg / 15, o.decDeg).symbol).toBe(o.constellation)
    }
  })

  it('contient les 250 étoiles les plus brillantes, triées, avec B−V', () => {
    expect(BRIGHT_STARS).toHaveLength(250)
    expect(BRIGHT_STARS[0]).toMatchObject({ name: 'Sirius', designation: 'α CMa', hip: 32349 })
    for (let i = 1; i < BRIGHT_STARS.length; i++) expect(BRIGHT_STARS[i].mag).toBeGreaterThanOrEqual(BRIGHT_STARS[i - 1].mag)
    expect(BRIGHT_STARS.at(-1)!.mag).toBeLessThan(3.5)
    const withBv = BRIGHT_STARS.filter((s) => s.bv !== null)
    expect(withBv.length).toBeGreaterThan(245)
    for (const s of withBv) {
      expect(s.bv!).toBeGreaterThan(-0.5)
      expect(s.bv!).toBeLessThan(2.5)
    }
    const betelgeuse = BRIGHT_STARS.find((s) => s.hip === 27989)!
    expect(betelgeuse.bv!).toBeGreaterThanOrEqual(1.5)
    expect(new Set(BRIGHT_STARS.map((s) => s.hip)).size).toBe(250)
    for (const s of BRIGHT_STARS) expect(inRange(s.raDeg, s.decDeg)).toBe(true)
  })

  it('contient les tracés des 88 constellations IAU', () => {
    expect(CONSTELLATION_FIGURES).toHaveLength(88)
    expect(new Set(CONSTELLATION_FIGURES.map((c) => c.id)).size).toBe(88)
    for (const c of CONSTELLATION_FIGURES) {
      expect(c.nameFr.length).toBeGreaterThan(2)
      expect(c.polylines.length).toBeGreaterThan(0)
      for (const line of c.polylines) {
        expect(line.length % 2).toBe(0)
        expect(line.length).toBeGreaterThanOrEqual(4)
        for (let i = 0; i < line.length; i += 2) expect(inRange(line[i], line[i + 1])).toBe(true)
      }
    }
    expect(CONSTELLATION_FIGURES.find((c) => c.id === 'Ori')?.nameFr).toBe('Orion')
  })

  it('essaims météoritiques complets et cohérents', () => {
    expect(METEOR_SHOWERS.length).toBeGreaterThanOrEqual(20)
    for (const code of ['QUA', 'LYR', 'ETA', 'SDA', 'PER', 'DRA', 'ORI', 'LEO', 'GEM', 'URS']) {
      expect(METEOR_SHOWERS.some((s) => s.code === code)).toBe(true)
    }
    for (const s of METEOR_SHOWERS) {
      expect(inRange(s.radiantRaDeg, s.radiantDecDeg)).toBe(true)
      expect(s.peakSolarLongitudeDeg).toBeGreaterThanOrEqual(0)
      expect(s.peakSolarLongitudeDeg).toBeLessThan(360)
      expect(s.velocityKmS).toBeGreaterThan(10)
      expect(s.velocityKmS).toBeLessThan(73)
    }
  })

  it('libellés d’affichage', () => {
    expect(deepSkyLabel(MESSIER_CATALOG[30])).toBe("M31 · Galaxie d'Andromède")
    expect(deepSkyLabel(NGC_IC_CATALOG.find((o) => o.id === 'NGC891')!)).toBe('NGC 891')
  })
})
