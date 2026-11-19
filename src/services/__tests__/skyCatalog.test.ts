import { Body, GeoVector, RotateVector, Rotation_EQJ_GAL, SphereFromVector } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import * as sky from '../../data/sky.generated'
import { createSkyProjector, getBodyHorizontal } from '../astroEngine'
import { buildSkyCatalog, loadSkyCatalog, starPhase } from '../sky/skyCatalog'
import { eqjToEnuMatrix, eqjVector, transformVector, transformVectors } from '../sky/skyFrame'
import { objectDirection, resolveSkyObject } from '../sky/skyObjects'
import { angleBetweenDeg, fromHorizontal, toHorizontal } from '../sky/vector'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const DATE = new Date('2026-11-18T21:00:00Z')
const cat = buildSkyCatalog(sky)

describe('données générées', () => {
  it('5044 étoiles Hipparcos triées par éclat, coordonnées valides', () => {
    expect(cat.stars.count).toBe(5044)
    for (let i = 1; i < cat.stars.count; i++) expect(cat.stars.mag[i]).toBeGreaterThanOrEqual(cat.stars.mag[i - 1])
    expect(cat.stars.mag[cat.stars.count - 1]).toBeLessThanOrEqual(6.1)
    for (let i = 0; i < cat.stars.eqj.length; i += 3) expect(Math.hypot(cat.stars.eqj[i], cat.stars.eqj[i + 1], cat.stars.eqj[i + 2])).toBeCloseTo(1, 9)
    expect(cat.stars.hip[0]).toBe(32349) // Sirius
    expect(cat.starNames.get(32349)).toBe('Sirius')
  })

  it('la Voie lactée suit le plan galactique', () => {
    const rot = Rotation_EQJ_GAL()
    const { eqj, level } = cat.milkyWay
    let near = 0
    for (let i = 0; i < level.length; i++) {
      const g = SphereFromVector(RotateVector(rot, { x: eqj[i * 3], y: eqj[i * 3 + 1], z: eqj[i * 3 + 2], t: undefined as never } as never))
      if (Math.abs(g.lat) < 30) near++
      if (level[i] >= 4) expect(Math.abs(g.lat)).toBeLessThan(25)
    }
    expect(near / level.length).toBeGreaterThan(0.9)
    expect(Math.max(...level)).toBe(5)
  })

  it('étiquettes des 88 constellations (Serpent : Tête et Queue)', () => {
    expect(new Set(cat.constellationLabels.map((l) => l.id)).size).toBe(88)
    expect(cat.constellationLabels.filter((l) => l.id === 'Ser')).toHaveLength(2)
    expect(cat.constellationLabels.find((l) => l.id === 'Ori')?.name).toBe('Orion')
  })

  it('l’écliptique J2000 passe par le Soleil', () => {
    const s = GeoVector(Body.Sun, DATE, true)
    const sun = [s.x, s.y, s.z].map((c) => c / Math.hypot(s.x, s.y, s.z))
    let best = 180
    for (let i = 0; i < cat.ecliptic.eqj.length; i += 3) {
      best = Math.min(best, angleBetweenDeg([cat.ecliptic.eqj[i], cat.ecliptic.eqj[i + 1], cat.ecliptic.eqj[i + 2]], sun as never))
    }
    expect(best).toBeLessThan(1.05) // pas d'échantillonnage 2° → ≤ 1° + précession
  })

  it('grille équatoriale : 17 parallèles + 24 cercles horaires', () => {
    expect(cat.equatorialGrid).toHaveLength(41)
    expect(cat.equatorialGrid.filter((l) => l.isEquator)).toHaveLength(1)
  })

  it('phase de scintillation stable et dans [0, 2π)', () => {
    expect(starPhase(32349)).toBe(starPhase(32349))
    expect(starPhase(1)).not.toBe(starPhase(2))
    for (const h of [0, 1, 99999, 120000]) expect(starPhase(h)).toBeLessThan(Math.PI * 2 + 1e-9)
  })

  it('chargement paresseux mémorisé', async () => {
    expect(await loadSkyCatalog()).toBe(await loadSkyCatalog())
  })
})

describe('repère J2000 → horizontal (astronomy-engine)', () => {
  const m = eqjToEnuMatrix(DATE, PARIS)
  const project = createSkyProjector(DATE, PARIS)

  it('coïncide avec HorizonFromVector (réfraction normale) à 0,001° près', () => {
    for (const [ra, dec] of [[279.23, 38.78], [10.68, 41.27], [101.29, -16.72], [37.95, 89.26], [83.82, -5.39]]) {
      const ref = project(ra, dec)
      const h = toHorizontal(transformVector(m, eqjVector(ra, dec)))
      expect(angleBetweenDeg(fromHorizontal(h.azimuthDeg, h.altitudeDeg), fromHorizontal(ref.azimuthDeg, ref.altitudeDeg))).toBeLessThan(0.001)
    }
  })

  it('transformation en bloc identique à la transformation unitaire', () => {
    const src = cat.stars.eqj.subarray(0, 30)
    const dst = new Float64Array(30)
    transformVectors(m, src, dst)
    const one = transformVector(m, [src[9], src[10], src[11]])
    expect(dst[9]).toBeCloseTo(one[0], 12)
    expect(dst[11]).toBeCloseTo(one[2], 12)
  })

  it('directions des objets : ciel profond et planètes', () => {
    const m31 = resolveSkyObject('M31', DATE, PARIS)!
    const ref = project(m31.raDeg, m31.decDeg)
    expect(angleBetweenDeg(objectDirection(m31, DATE, PARIS, m), fromHorizontal(ref.azimuthDeg, ref.altitudeDeg))).toBeLessThan(0.001)
    const jup = resolveSkyObject('Jupiter', DATE, PARIS)!
    const h = getBodyHorizontal('Jupiter', DATE, PARIS)
    expect(angleBetweenDeg(objectDirection(jup, DATE, PARIS, m), fromHorizontal(h.azimuthDeg, h.altitudeDeg))).toBeLessThan(1e-9)
    expect(jup.kind).toBe('planet')
    expect(resolveSkyObject('HIP32349', DATE, PARIS)?.label).toBe('Sirius')
    expect(resolveSkyObject('M31', DATE, PARIS)?.label).toContain('Andromède')
    expect(resolveSkyObject('XYZ', DATE, PARIS)).toBeNull()
  })
})
