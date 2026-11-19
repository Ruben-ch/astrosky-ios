import { describe, expect, it } from 'vitest'
import { MESSIER_CATALOG } from '../../data'
import { createSkyProjector, getDarkWindow } from '../astroEngine'
import { INSTRUMENTS, effectiveSurfaceLimit, stellarLimitingMagnitude, surfaceBrightness } from '../targets/instruments'
import { MIN_DSO_ALTITUDE_DEG, rankTargets } from '../targets/rankTargets'
import { altitudeScore, altitudeStats } from '../targets/sampling'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const SANTIAGO = { latitudeDeg: -33.45, longitudeDeg: -70.67, elevationM: 570 }
const DATE = new Date('2026-11-18T21:00:00Z')

describe('photométrie des instruments', () => {
  it('gain d’ouverture en 5·log10(D/7)', () => {
    expect(stellarLimitingMagnitude(INSTRUMENTS['naked-eye'], 6.5)).toBeCloseTo(6.5, 6)
    expect(stellarLimitingMagnitude(INSTRUMENTS.binoculars, 6.5)).toBeCloseTo(10.77, 2)
    expect(stellarLimitingMagnitude(INSTRUMENTS.telescope, 6)).toBeCloseTo(13.28, 2)
  })

  it('brillance de surface de M33 ≈ 23 mag/arcsec²', () => {
    expect(surfaceBrightness(5.7, 70, 41)).toBeCloseTo(23, 0)
    expect(surfaceBrightness(8, null, null)).toBeNull()
    expect(surfaceBrightness(8, 2, null)).toBeCloseTo(surfaceBrightness(8, 2, 2)!, 9)
  })

  it('la Lune abaisse la limite de surface', () => {
    expect(effectiveSurfaceLimit(INSTRUMENTS.telescope, 6.5)).toBe(24)
    expect(effectiveSurfaceLimit(INSTRUMENTS.telescope, 4.5)).toBe(22)
  })

  it('statistiques et note de hauteur', () => {
    expect(altitudeStats([10, 40, 70, 35], 15)).toEqual({ maxAltitudeDeg: 70, bestIndex: 2, minutesAbove30Deg: 45 })
    expect(altitudeScore(90, 240)).toBeCloseTo(1, 9)
    expect(altitudeScore(30, 0)).toBeLessThan(altitudeScore(60, 0))
  })
})

describe('classement des cibles (Paris, 18 nov. 2026)', () => {
  const eye = rankTargets(DATE, PARIS, { instrument: 'naked-eye' })
  const bino = rankTargets(DATE, PARIS, { instrument: 'binoculars' })
  const scope = rankTargets(DATE, PARIS, { instrument: 'telescope', limit: 40 })

  it('listes triées, plafonnées et notes dans [0, 100]', () => {
    for (const list of [eye, bino]) {
      expect(list.length).toBeLessThanOrEqual(15)
      for (let i = 0; i < list.length; i++) {
        expect(list[i].score).toBeGreaterThan(0)
        expect(list[i].score).toBeLessThanOrEqual(100)
        if (i > 0) expect(list[i].score).toBeLessThanOrEqual(list[i - 1].score)
      }
    }
    expect(scope).toHaveLength(40)
  })

  it('l’œil nu ne propose que des objets brillants', () => {
    for (const t of eye) if (t.kind === 'deep-sky') expect(t.magnitude!).toBeLessThanOrEqual(6)
    expect(eye.some((t) => t.key === 'M45')).toBe(true)
    expect(eye.some((t) => t.key === 'Neptune')).toBe(false)
  })

  it('le télescope atteint des objets plus faibles que les jumelles', () => {
    const faintest = (l: typeof scope) => Math.max(...l.filter((t) => t.kind === 'deep-sky').map((t) => t.magnitude!))
    expect(faintest(scope)).toBeGreaterThan(faintest(bino))
  })

  it('les objets retenus culminent réellement au-dessus du seuil pendant la nuit', () => {
    const win = getDarkWindow(DATE, PARIS)
    for (const t of scope.filter((x) => x.kind === 'deep-sky')) {
      expect(t.maxAltitudeDeg).toBeGreaterThanOrEqual(MIN_DSO_ALTITUDE_DEG)
      expect(t.bestTime! >= win.start && t.bestTime! <= win.end).toBe(true)
      const o = MESSIER_CATALOG.find((m) => m.id === t.key)
      if (o) expect(createSkyProjector(t.bestTime!, PARIS)(o.raDeg, o.decDeg).altitudeDeg).toBeCloseTo(t.maxAltitudeDeg, 6)
    }
  })

  it('propose la Lune gibbeuse et Jupiter, avec clés de verrouillage', () => {
    const all = [...eye, ...bino]
    expect(all.find((t) => t.key === 'Moon')?.kind).toBe('moon')
    expect(all.find((t) => t.key === 'Jupiter')?.bodyId).toBe('Jupiter')
  })

  it('hémisphère sud : Oméga du Centaure en mai, invisible depuis Paris', () => {
    const may = new Date('2026-05-15T03:00:00Z')
    const south = rankTargets(may, SANTIAGO, { instrument: 'binoculars', limit: 60 })
    expect(south.some((t) => t.key === 'NGC5139')).toBe(true)
    const north = rankTargets(may, PARIS, { instrument: 'binoculars', limit: 200 })
    expect(north.some((t) => t.key === 'NGC5139')).toBe(false)
  })
})
