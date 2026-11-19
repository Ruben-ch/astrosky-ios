import { beforeEach, describe, expect, it } from 'vitest'
import { TELESCOPE_PRESETS } from '../../data/instrumentPresets'
import { setCacheStorage } from '../cache'
import { findDeepSkyEntry, getDeepSkyEntries } from '../catalog/entries'
import { fieldNeighbors, gnomonic } from '../optics/fieldProjection'
import { angularSizeDeg, computePhotoFov, computeVisualFov, framingFit, viewSpanArcmin } from '../optics/fov'
import {
  DEFAULT_FOV_SETTINGS,
  loadFovSettings,
  normalizeRotation,
  sanitizeFovSettings,
  saveFovSettings,
  stepApparentField,
  withSensorPreset,
  withTelescopePreset,
} from '../optics/fovSettings'
import { createMemoryStorage } from './memoryStorage'

const C8 = { kind: 'sct' as const, apertureMm: 203, focalLengthMm: 2032 }

describe('mode visuel', () => {
  it('grossissement, pupille de sortie et champ réel', () => {
    const v = computeVisualFov(C8, { focalLengthMm: 25, apparentFieldDeg: 52 }, 1)
    expect(v.magnification).toBeCloseTo(81.28, 2)
    expect(v.exitPupilMm).toBeCloseTo(2.4975, 3)
    expect(v.trueFieldDeg).toBeCloseTo(0.6398, 3)
    expect(v.focalRatio).toBeCloseTo(10.01, 2)
    expect(v.maxUsefulMagnification).toBe(406)
    expect(v.minUsefulMagnification).toBeCloseTo(29, 0)
    expect(v.warnings).toEqual([])
  })

  it('la Barlow multiplie le grossissement et divise champ et pupille', () => {
    const e = { focalLengthMm: 10, apparentFieldDeg: 68 }
    const x1 = computeVisualFov(C8, e, 1)
    const x3 = computeVisualFov(C8, e, 3)
    expect(x3.magnification).toBeCloseTo(3 * x1.magnification, 6)
    expect(x3.trueFieldDeg).toBeCloseTo(x1.trueFieldDeg / 3, 6)
    expect(x3.exitPupilMm).toBeCloseTo(x1.exitPupilMm / 3, 6)
    expect(x3.effectiveFocalMm).toBe(6096)
    expect(x3.warnings).toContain('over-magnified')
  })

  it('signale une pupille de sortie trop grande', () => {
    const v = computeVisualFov({ kind: 'newtonian', apertureMm: 200, focalLengthMm: 800 }, { focalLengthMm: 40, apparentFieldDeg: 43 }, 1)
    expect(v.exitPupilMm).toBe(10)
    expect(v.warnings).toEqual(['exit-pupil-too-large'])
  })
})

describe('mode photo', () => {
  it('champ d’un capteur plein format à 1000 mm', () => {
    const p = computePhotoFov({ kind: 'newtonian', apertureMm: 200, focalLengthMm: 1000 }, { widthMm: 36, heightMm: 24 })
    expect(p.widthDeg).toBeCloseTo(2.0626, 3)
    expect(p.heightDeg).toBeCloseTo(1.3750, 3)
    expect(p.diagonalDeg).toBeCloseTo(2.4786, 3)
    expect(p.focalRatio).toBe(5)
    expect(p.arcsecPerMm).toBeCloseTo(206.26, 2)
  })

  it('petit angle : taille ≈ longueur / focale (radians)', () => {
    expect(angularSizeDeg(1, 10_000)).toBeCloseTo((1 / 10_000) * (180 / Math.PI), 8)
  })
})

describe('cadrage et échelle', () => {
  it('remplissage du cadre', () => {
    expect(framingFit(178, 120)!.verdict).toBe('overflow')
    expect(framingFit(60, 120)).toEqual({ ratio: 0.5, verdict: 'good' })
    expect(framingFit(1, 120)!.verdict).toBe('tiny')
    expect(framingFit(null, 120)).toBeNull()
  })

  it('l’étendue affichée englobe le champ, et l’objet jusqu’à 3 × le champ', () => {
    expect(viewSpanArcmin(60, 5)).toBeCloseTo(73.2, 6)
    expect(viewSpanArcmin(60, 100)).toBeCloseTo(115, 6)
    expect(viewSpanArcmin(30, 300)).toBe(90)
  })
})

describe('projection du champ', () => {
  it('centre en (0, 0), est positif vers les AD croissantes', () => {
    expect(gnomonic(10, 41, 10, 41)).toEqual({ eastArcmin: 0, northArcmin: 0 })
    const p = gnomonic(10, 0, 10.5, 0)!
    expect(p.eastArcmin).toBeCloseTo(30, 1)
    expect(p.northArcmin).toBeCloseTo(0, 6)
    expect(gnomonic(0, 0, 180, 0)).toBeNull()
  })

  it('M32 et M110 apparaissent autour de M31 à leur position réelle', () => {
    const m31 = findDeepSkyEntry('M31')!.object
    const n = fieldNeighbors(m31.raDeg, m31.decDeg, 90, getDeepSkyEntries(), 'M31')
    const ids = n.filter((x) => x.kind === 'dso').map((x) => (x.kind === 'dso' ? x.entry.object.id : ''))
    expect(ids).toEqual(expect.arrayContaining(['M32', 'M110']))
    expect(ids).not.toContain('M31')
    const m32 = n.find((x) => x.kind === 'dso' && x.entry.object.id === 'M32')!
    expect(m32.northArcmin).toBeLessThan(-15) // M32 est au sud de M31
  })
})

describe('configuration du simulateur', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('préréglages de télescope et de capteur', () => {
    const sct = withTelescopePreset(DEFAULT_FOV_SETTINGS, 'sct-203-2032')
    expect(sct.telescope).toEqual({ kind: 'sct', apertureMm: 203, focalLengthMm: 2032 })
    const custom = withTelescopePreset(sct, 'custom')
    expect(custom).toMatchObject({ telescopeId: 'custom', telescope: { kind: 'custom', apertureMm: 203 } })
    expect(withSensorPreset(DEFAULT_FOV_SETTINGS, 'micro-4-3').sensor).toEqual({ widthMm: 17.3, heightMm: 13 })
    expect(TELESCOPE_PRESETS.map((p) => p.kind)).toEqual(expect.arrayContaining(['refractor', 'newtonian', 'sct']))
  })

  it('valide et borne les valeurs stockées', () => {
    expect(sanitizeFovSettings(undefined)).toEqual(DEFAULT_FOV_SETTINGS)
    const s = sanitizeFovSettings({ mode: 'photo', telescopeId: 'nope', telescope: { apertureMm: 5, focalLengthMm: 'x' }, barlow: 5, sensorRotationDeg: 270, orientation: 'up' })
    expect(s.mode).toBe('photo')
    expect(s.telescopeId).toBe(DEFAULT_FOV_SETTINGS.telescopeId)
    expect(s.telescope.apertureMm).toBe(30)
    expect(s.telescope.focalLengthMm).toBe(DEFAULT_FOV_SETTINGS.telescope.focalLengthMm)
    expect(s.barlow).toBe(1)
    expect(s.sensorRotationDeg).toBe(90)
    expect(s.orientation).toBe('sky')
    expect(normalizeRotation(-30)).toBe(150)
  })

  it('champ apparent pas à pas', () => {
    expect(stepApparentField(52, 1)).toBe(60)
    expect(stepApparentField(55, -1)).toBe(52)
    expect(stepApparentField(100, 1)).toBe(100)
    expect(stepApparentField(43, -1)).toBe(43)
  })

  it('persiste la configuration hors-ligne', async () => {
    const s = { ...withTelescopePreset(DEFAULT_FOV_SETTINGS, 'refractor-80-480'), mode: 'photo' as const, barlow: 2 as const }
    await saveFovSettings(s)
    expect(await loadFovSettings()).toEqual(s)
  })
})
