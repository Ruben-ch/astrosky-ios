import { beforeEach, describe, expect, it } from 'vitest'
import { setCacheStorage } from '../cache'
import { GuidanceTracker, guidanceReading, lockRadiusDeg, pointingDelta, pulseIntervalMs } from '../sky/guidance'
import { OrientationFilter, absoluteAlphaDeg, cameraPoseFromOrientation, sampleFromEvent, viewFromPose } from '../sky/orientation'
import { viewBasis } from '../sky/projection'
import { DEFAULT_SKY_SETTINGS, loadSkySettings, sanitizeSettings, saveSkySettings } from '../sky/skySettings'
import { gridStepDeg, limitingMagnitude, pickNearest, starRadiusPx, twinkleFactor } from '../sky/skyStyle'
import { fromHorizontal } from '../sky/vector'
import type { OrientationSample, SkyObjectRef } from '../../types/sky'
import { createMemoryStorage } from './memoryStorage'

const sample = (beta: number, gamma: number, heading: number | null, alpha = 0): OrientationSample => ({
  alphaDeg: alpha, betaDeg: beta, gammaDeg: gamma, compassHeadingDeg: heading, absolute: false, timeMs: 0,
})
const viewOf = (s: OrientationSample) => viewFromPose(cameraPoseFromOrientation(s)!, 60)

describe('orientation iOS → direction de visée', () => {
  it('téléphone vertical face au nord : horizon nord, sans roulis', () => {
    const v = viewOf(sample(90, 0, 0))
    expect(v.azimuthDeg % 360).toBeCloseTo(0, 6)
    expect(v.altitudeDeg).toBeCloseTo(0, 6)
    expect(v.rollDeg).toBeCloseTo(0, 6)
  })

  it('le cap boussole donne l’azimut', () => {
    expect(viewOf(sample(90, 0, 90)).azimuthDeg).toBeCloseTo(90, 6)
    expect(viewOf(sample(90, 0, 250)).azimuthDeg).toBeCloseTo(250, 6)
  })

  it('l’inclinaison beta donne la hauteur', () => {
    expect(viewOf(sample(135, 0, 0)).altitudeDeg).toBeCloseTo(45, 6)
    expect(viewOf(sample(170, 0, 0)).altitudeDeg).toBeCloseTo(80, 6)
    expect(viewOf(sample(0, 0, 0)).altitudeDeg).toBeCloseTo(-90, 6)
  })

  it('téléphone vertical : gamma pivote autour de l’axe vertical (lacet)', () => {
    const v = viewOf(sample(90, 20, 0))
    expect(v.azimuthDeg).toBeCloseTo(340, 6)
    expect(v.altitudeDeg).toBeCloseTo(0, 6)
  })

  it('la base de vue reconstruite (avec roulis) redonne la pose exacte', () => {
    for (const s of [sample(120, 30, 70), sample(60, -45, 200), sample(150, 10, 310)]) {
      const pose = cameraPoseFromOrientation(s)!
      const b = viewBasis(viewFromPose(pose, 60))
      for (let k = 0; k < 3; k++) {
        expect(b.f[k]).toBeCloseTo(pose.direction[k], 9)
        expect(b.u[k]).toBeCloseTo(pose.up[k], 9)
      }
    }
    expect(Math.abs(viewOf(sample(120, 30, 70)).rollDeg)).toBeGreaterThan(5)
  })

  it('alpha absolu : boussole prioritaire, sinon alpha', () => {
    expect(absoluteAlphaDeg(sample(90, 0, 30))).toBe(330)
    expect(absoluteAlphaDeg(sample(90, 0, null, 42))).toBe(42)
    expect(cameraPoseFromOrientation({ ...sample(90, 0, 0), betaDeg: null })).toBeNull()
  })

  it('convertit un évènement natif (cap négatif = invalide)', () => {
    expect(sampleFromEvent({ alpha: 1, beta: 2, gamma: 3, webkitCompassHeading: -1 }, 5).compassHeadingDeg).toBeNull()
    expect(sampleFromEvent({ alpha: 1, beta: 2, gamma: 3, webkitCompassHeading: 12 }, 5)).toMatchObject({ compassHeadingDeg: 12, timeMs: 5 })
  })
})

describe('filtre passe-bas', () => {
  it('coefficient 1 − e^(−dt/τ)', () => {
    expect(OrientationFilter.alpha(0, 100)).toBe(0)
    expect(OrientationFilter.alpha(100, 100)).toBeCloseTo(1 - Math.exp(-1), 12)
  })

  it('converge vers la mesure et lisse le tremblement', () => {
    const f = new OrientationFilter(100)
    let out = f.update(cameraPoseFromOrientation(sample(90, 0, 0))!, 0)
    for (let t = 16; t <= 1000; t += 16) {
      const jitter = t % 32 === 0 ? 2 : -2
      out = f.update(cameraPoseFromOrientation(sample(90, 0, 40 + jitter))!, t)
    }
    const v = viewFromPose(out, 60)
    expect(v.azimuthDeg).toBeGreaterThan(38.5)
    expect(v.azimuthDeg).toBeLessThan(41.5)
  })

  it('ne saute pas au passage 359° → 1°', () => {
    const f = new OrientationFilter(100)
    f.update(cameraPoseFromOrientation(sample(90, 0, 359))!, 0)
    const v = viewFromPose(f.update(cameraPoseFromOrientation(sample(90, 0, 1))!, 16), 60)
    const delta = Math.min(Math.abs(v.azimuthDeg - 359), Math.abs(v.azimuthDeg + 1))
    expect(delta).toBeLessThan(2)
  })
})

describe('guidage cible', () => {
  const basis = viewBasis({ azimuthDeg: 180, altitudeDeg: 30, fovDeg: 60, rollDeg: 0 })

  it('écart et direction de la flèche', () => {
    expect(guidanceReading(basis, fromHorizontal(180, 30)).separationDeg).toBeCloseTo(0, 9)
    expect(guidanceReading(basis, fromHorizontal(180, 50)).screenAngleRad).toBeCloseTo(Math.PI / 2, 6)
    expect(Math.abs(guidanceReading(basis, fromHorizontal(150, 30)).screenAngleRad)).toBeGreaterThan(Math.PI / 2) // sud-est à gauche
    expect(guidanceReading(basis, fromHorizontal(0, 30)).separationDeg).toBeCloseTo(120, 6)
    expect(guidanceReading(basis, fromHorizontal(0, -10)).belowHorizon).toBe(true)
  })

  it('rayon de capture borné et impulsions de plus en plus rapides', () => {
    expect(lockRadiusDeg(5)).toBe(1)
    expect(lockRadiusDeg(60)).toBe(3)
    expect(lockRadiusDeg(150)).toBe(4)
    expect(pulseIntervalMs(40, 2)).toBeGreaterThan(pulseIntervalMs(10, 2))
    expect(pulseIntervalMs(2, 2)).toBe(110)
  })

  it('consigne de pointage par le chemin le plus court', () => {
    expect(pointingDelta(350, 10, 20, 40)).toEqual({ dAzDeg: 30, dAltDeg: 30 })
    expect(pointingDelta(20, 50, 350, 10)).toEqual({ dAzDeg: -30, dAltDeg: -40 })
    expect(pointingDelta(0, 0, 180, 0).dAzDeg).toBe(-180)
  })

  it('verrouille une seule fois, avec hystérésis', () => {
    const t = new GuidanceTracker()
    expect(t.update(30, 2, 0)).toBe('pulse')
    expect(t.update(29, 2, 10)).toBeNull()
    expect(t.update(1.5, 2, 2000)).toBe('lock')
    expect(t.isLocked).toBe(true)
    expect(t.update(1, 2, 2100)).toBeNull()
    expect(t.update(3, 2, 2200)).toBeNull() // < 1,8 × 2°
    expect(t.update(4, 2, 2300)).toBe('unlock')
    expect(t.update(90, 2, 9000)).toBeNull()
  })
})

describe('style et sélection', () => {
  it('magnitude limite et taille des étoiles', () => {
    expect(limitingMagnitude(20)).toBe(6)
    expect(limitingMagnitude(150)).toBe(5)
    expect(starRadiusPx(-1.4, 90)).toBeGreaterThan(starRadiusPx(3, 90))
    expect(starRadiusPx(3, 20)).toBeGreaterThan(starRadiusPx(3, 90))
    expect(starRadiusPx(6, 150)).toBeGreaterThanOrEqual(0.45)
  })

  it('scintillation bornée, nulle en altitude', () => {
    expect(twinkleFactor(1, 3, 80, 1)).toBe(1)
    for (let t = 0; t < 10; t += 0.37) {
      const k = twinkleFactor(2, t, 5, 0)
      expect(k).toBeGreaterThanOrEqual(0.75)
      expect(k).toBeLessThanOrEqual(1.25)
    }
    expect(gridStepDeg(120)).toBe(15)
    expect(gridStepDeg(8)).toBe(1)
  })

  it('sélection : plus proche, priorité aux astres majeurs', () => {
    const ref = (key: string): SkyObjectRef => ({ key, kind: 'star', label: key, magnitude: 1, raDeg: 0, decDeg: 0, bodyId: null, deepSkyType: null })
    const c = [
      { x: 100, y: 100, ref: ref('star'), priority: 3 },
      { x: 112, y: 100, ref: ref('jupiter'), priority: 0 },
    ]
    expect(pickNearest(c, 101, 100)?.key).toBe('jupiter')
    expect(pickNearest(c, 300, 300)).toBeNull()
  })
})

describe('préférences du planétarium', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('fusionne une valeur partielle et repart en mode tactile', () => {
    const s = sanitizeSettings({ layers: { altAzGrid: true, bogus: 1 }, projection: 'equidistant', mode: 'sensors' })
    expect(s.layers.altAzGrid).toBe(true)
    expect(s.layers.milkyWay).toBe(true)
    expect(s.projection).toBe('equidistant')
    expect(s.mode).toBe('touch')
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SKY_SETTINGS)
  })

  it('persiste hors-ligne', async () => {
    await saveSkySettings({ ...DEFAULT_SKY_SETTINGS, projection: 'equidistant' })
    expect((await loadSkySettings()).projection).toBe('equidistant')
  })
})
