import { beforeEach, describe, expect, it } from 'vitest'
import { setCacheStorage } from '../cache'
import {
  applyOrbit,
  applyZoom,
  cameraPosition,
  clampElevation,
  decay,
  dragToAngles,
  easeInOutCubic,
  fitDistance,
  focusDistance,
  initialCamera,
  interpolateCamera,
  MAX_DISTANCE,
  MAX_ELEVATION_RAD,
  MIN_DISTANCE,
  VIEW_ELEVATION_RAD,
  viewModeOf,
  wrapPi,
} from '../orrery/cameraRig'
import { DEFAULT_ORRERY_SETTINGS, loadOrrerySettings, sanitizeOrrerySettings, saveOrrerySettings } from '../orrery/orrerySettings'
import { isDoubleTap, MIN_PICK_RADIUS_PX, pickBody } from '../orrery/picking'
import type { OrbitCameraState, ScreenPick } from '../../types/orrery'
import { createMemoryStorage } from './memoryStorage'

const base: OrbitCameraState = { target: [0, 0, 0], distance: 10, azimuthRad: 0, elevationRad: 0 }

describe('caméra orbitale', () => {
  it('place la caméra sur la sphère autour de la cible', () => {
    expect(cameraPosition(base)).toEqual([0, 0, 10])
    const top = cameraPosition({ ...base, elevationRad: Math.PI / 2 })
    expect(top[1]).toBeCloseTo(10, 10)
    const p = cameraPosition({ ...base, target: [1, 2, 3], azimuthRad: Math.PI / 2 })
    expect(p[0]).toBeCloseTo(11, 10)
    expect(p[1]).toBeCloseTo(2, 10)
    expect(p[2]).toBeCloseTo(3, 10)
  })

  it('borne l’élévation sous le pôle et la distance', () => {
    expect(clampElevation(2)).toBe(MAX_ELEVATION_RAD)
    expect(clampElevation(-2)).toBe(-MAX_ELEVATION_RAD)
    expect(applyZoom(base, 1e6).distance).toBe(MAX_DISTANCE)
    expect(applyZoom(base, 1e-6).distance).toBe(MIN_DISTANCE)
    expect(applyZoom(base, 1e-6, 2).distance).toBe(2)
    expect(applyZoom(base, NaN)).toBe(base)
    expect(applyZoom(base, 0.5).distance).toBe(5)
  })

  it('convertit un glissement en orbite (vers la droite = azimut décroissant)', () => {
    const d = dragToAngles(100, -50, 800)
    expect(d.dAzimuthRad).toBeLessThan(0)
    expect(d.dElevationRad).toBeLessThan(0)
    const s = applyOrbit(base, 7, 0)
    expect(s.azimuthRad).toBeCloseTo(wrapPi(7), 10)
    expect(Math.abs(s.azimuthRad)).toBeLessThanOrEqual(Math.PI)
  })

  it('normalise les angles dans ]−π, π]', () => {
    expect(wrapPi(Math.PI)).toBeCloseTo(Math.PI, 10)
    expect(wrapPi(-Math.PI)).toBeCloseTo(Math.PI, 10)
    expect(wrapPi(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 10)
  })

  it('amortit l’inertie indépendamment du découpage en frames', () => {
    const oneStep = decay(1, 0.1)
    let v = 1
    for (let i = 0; i < 10; i++) v = decay(v, 0.01)
    expect(v).toBeCloseTo(oneStep, 8)
    expect(decay(1e-5, 0.016)).toBe(0)
    expect(decay(1, -1)).toBe(1)
  })

  it('anime par le plus court chemin en azimut', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
    const from = { ...base, azimuthRad: 3, distance: 1 }
    const to: OrbitCameraState = { target: [4, 0, 0], distance: 100, azimuthRad: -3, elevationRad: 1 }
    const mid = interpolateCamera(from, to, 0.5)
    // 3 → −3 rad passe par ±π (0,28 rad), pas par 0 (6 rad).
    expect(Math.abs(mid.azimuthRad)).toBeGreaterThan(3)
    expect(mid.distance).toBeCloseTo(10, 6)
    expect(mid.target[0]).toBeCloseTo(2, 10)
    const end = interpolateCamera(from, to, 1)
    expect(end.azimuthRad).toBeCloseTo(-3, 10)
    expect(end.elevationRad).toBeCloseTo(1, 10)
  })

  it('cadre une sphère selon la plus petite dimension', () => {
    const portrait = fitDistance(10, 0.5)
    const landscape = fitDistance(10, 2)
    expect(portrait).toBeGreaterThan(landscape)
    expect(focusDistance(0.3, 2, 0.5)).toBeGreaterThanOrEqual(fitDistance(2, 0.5) - 1e-9)
    expect(focusDistance(0.3, 0.3, 0.5)).toBeGreaterThanOrEqual(2.1)
  })

  it('préréglages écliptique et polaire', () => {
    expect(initialCamera('polar', 10, 0.5).elevationRad).toBe(VIEW_ELEVATION_RAD.polar)
    expect(viewModeOf(VIEW_ELEVATION_RAD.polar)).toBe('polar')
    expect(viewModeOf(VIEW_ELEVATION_RAD.ecliptic)).toBe('ecliptic')
    expect(initialCamera('ecliptic', 10, 0.5).target).toEqual([0, 0, 0])
  })
})

describe('sélection au toucher', () => {
  const picks: ScreenPick[] = [
    { id: 'Jupiter', x: 100, y: 100, radiusPx: 12, depth: 20 },
    { id: 'Io', x: 116, y: 100, radiusPx: 2, depth: 20.1 },
    { id: 'Mars', x: 300, y: 300, radiusPx: 1, depth: 10 },
  ]

  it('choisit le disque touché, puis le plus proche dans la zone de capture', () => {
    expect(pickBody(picks, 101, 101)).toBe('Jupiter')
    expect(pickBody(picks, 117, 100)).toBe('Io')
    expect(pickBody(picks, 300 + MIN_PICK_RADIUS_PX - 1, 300)).toBe('Mars')
    expect(pickBody(picks, 300 + MIN_PICK_RADIUS_PX + 2, 300)).toBeNull()
    expect(pickBody([], 0, 0)).toBeNull()
  })

  it('départage deux disques superposés par la profondeur', () => {
    const overlap: ScreenPick[] = [
      { id: 'Saturn', x: 50, y: 50, radiusPx: 5, depth: 30 },
      { id: 'Earth', x: 50, y: 50, radiusPx: 5, depth: 3 },
    ]
    expect(pickBody(overlap, 50, 50)).toBe('Earth')
  })

  it('reconnaît un double-tap', () => {
    const a = { timeMs: 1000, x: 10, y: 10 }
    expect(isDoubleTap(null, a)).toBe(false)
    expect(isDoubleTap(a, { timeMs: 1200, x: 20, y: 15 })).toBe(true)
    expect(isDoubleTap(a, { timeMs: 1500, x: 10, y: 10 })).toBe(false)
    expect(isDoubleTap(a, { timeMs: 1100, x: 90, y: 10 })).toBe(false)
  })
})

describe('préférences du Système Solaire', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('assainit les valeurs stockées', () => {
    expect(sanitizeOrrerySettings(null)).toEqual(DEFAULT_ORRERY_SETTINGS)
    expect(sanitizeOrrerySettings({ viewMode: 'polar', showOrbits: 'oui', follow: false })).toEqual({
      ...DEFAULT_ORRERY_SETTINGS,
      viewMode: 'polar',
      follow: false,
    })
  })

  it('persiste et relit hors-ligne', async () => {
    expect(await loadOrrerySettings()).toEqual(DEFAULT_ORRERY_SETTINGS)
    await saveOrrerySettings({ ...DEFAULT_ORRERY_SETTINGS, showLabels: false })
    expect((await loadOrrerySettings()).showLabels).toBe(false)
  })
})
