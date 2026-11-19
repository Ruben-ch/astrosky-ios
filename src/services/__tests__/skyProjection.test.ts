import { describe, expect, it } from 'vitest'
import {
  MAX_FOV_DEG,
  MIN_FOV_DEG,
  createProjector,
  inverseRadius,
  normalizeView,
  panView,
  pixelScale,
  project,
  projectedRadius,
  unproject,
  viewBasis,
  zoomView,
} from '../sky/projection'
import { angleBetweenDeg, dot, fromHorizontal, toHorizontal, wrap360 } from '../sky/vector'
import type { ProjectionKind, SkyView } from '../../types/sky'

const VP = { width: 393, height: 700 }
const VIEW: SkyView = { azimuthDeg: 120, altitudeDeg: 35, fovDeg: 90, rollDeg: 0 }
const KINDS: ProjectionKind[] = ['stereographic', 'equidistant']

describe('vecteurs ENU', () => {
  it('convertit azimut/hauteur aller-retour', () => {
    for (const [az, alt] of [[0, 0], [90, 10], [215.5, -42], [359.9, 89]]) {
      const h = toHorizontal(fromHorizontal(az, alt))
      expect(h.azimuthDeg).toBeCloseTo(az, 9)
      expect(h.altitudeDeg).toBeCloseTo(alt, 9)
    }
    expect(fromHorizontal(90, 0)[0]).toBeCloseTo(1, 12) // Est = +x
    expect(angleBetweenDeg(fromHorizontal(0, 0), fromHorizontal(0, 90))).toBeCloseTo(90, 9)
    expect(wrap360(-30)).toBe(330)
  })
})

describe('base de vue', () => {
  it('orthonormée, droite horizontale sans roulis, regard vers le nord → droite = est', () => {
    const b = viewBasis({ azimuthDeg: 0, altitudeDeg: 0, fovDeg: 60, rollDeg: 0 })
    expect(b.r[0]).toBeCloseTo(1, 12)
    expect(b.u[2]).toBeCloseTo(1, 12)
    const b2 = viewBasis({ ...VIEW, rollDeg: 25 })
    expect(dot(b2.f, b2.r)).toBeCloseTo(0, 12)
    expect(dot(b2.f, b2.u)).toBeCloseTo(0, 12)
    expect(dot(b2.r, b2.u)).toBeCloseTo(0, 12)
  })

  it('reste définie au zénith', () => {
    const b = viewBasis({ azimuthDeg: 45, altitudeDeg: 90, fovDeg: 60, rollDeg: 0 })
    expect(Math.hypot(...b.r)).toBeCloseTo(1, 12)
    expect(Math.hypot(...b.u)).toBeCloseTo(1, 12)
  })
})

describe.each(KINDS)('projection %s', (kind) => {
  const p = createProjector(VIEW, kind, VP)

  it('centre de vue au centre de l’écran', () => {
    const c = project(p, fromHorizontal(VIEW.azimuthDeg, VIEW.altitudeDeg))!
    expect(c.x).toBeCloseTo(VP.width / 2, 9)
    expect(c.y).toBeCloseTo(VP.height / 2, 9)
    expect(c.cosFromCenter).toBeCloseTo(1, 12)
  })

  it('le champ horizontal remplit exactement la largeur', () => {
    const horizonView = { ...VIEW, altitudeDeg: 0 }
    const q = createProjector(horizonView, kind, VP)
    expect(project(q, fromHorizontal(VIEW.azimuthDeg + 45, 0))!.x).toBeCloseTo(VP.width, 6)
    expect(project(q, fromHorizontal(VIEW.azimuthDeg - 45, 0))!.x).toBeCloseTo(0, 6)
  })

  it('le haut de l’écran est vers le zénith et l’est à droite (regard au sud)', () => {
    const q = createProjector({ azimuthDeg: 180, altitudeDeg: 20, fovDeg: 60, rollDeg: 0 }, kind, VP)
    expect(project(q, fromHorizontal(180, 30))!.y).toBeLessThan(VP.height / 2)
    expect(project(q, fromHorizontal(170, 20))!.x).toBeLessThan(VP.width / 2) // sud-est à gauche
  })

  it('inverse exacte (aller-retour < 1e-9°)', () => {
    for (const [az, alt] of [[100, 20], [150, 60], [60, -5], [200, 40]]) {
      const v = fromHorizontal(az, alt)
      const s = project(p, v)!
      expect(angleBetweenDeg(unproject(p, s.x, s.y), v)).toBeLessThan(1e-9)
    }
  })

  it('n’affiche pas les points au-delà de 120° du centre', () => {
    expect(project(p, fromHorizontal(VIEW.azimuthDeg + 180, -VIEW.altitudeDeg))).toBeNull()
  })

  it('rayon projeté et inverse réciproques', () => {
    for (const t of [0.01, 0.5, 1.2, 2]) expect(inverseRadius(kind, projectedRadius(kind, t))).toBeCloseTo(t, 12)
    expect(pixelScale(kind, 90, 400)).toBeGreaterThan(pixelScale(kind, 120, 400))
  })

  it('pan attrapé : la direction saisie suit le doigt', () => {
    const grab = unproject(p, 100, 200)
    const moved = panView(VIEW, kind, VP, 100, 200, 160, 260)
    const s = project(createProjector(moved, kind, VP), grab)!
    expect(s.x).toBeCloseTo(160, 0)
    expect(s.y).toBeCloseTo(260, 0)
  })

  it('zoom pincé : le pivot reste fixe et le champ est borné', () => {
    const pivot = unproject(p, 300, 150)
    const z = zoomView(VIEW, kind, VP, 2, 300, 150)
    expect(z.fovDeg).toBeCloseTo(45, 9)
    const s = project(createProjector(z, kind, VP), pivot)!
    expect(Math.hypot(s.x - 300, s.y - 150)).toBeLessThan(1.5)
    expect(zoomView(VIEW, kind, VP, 1000, 200, 350).fovDeg).toBe(MIN_FOV_DEG)
    expect(zoomView(VIEW, kind, VP, 0.001, 200, 350).fovDeg).toBe(MAX_FOV_DEG)
  })
})

describe('normalisation de vue', () => {
  it('borne hauteur, champ et azimut', () => {
    expect(normalizeView({ azimuthDeg: -10, altitudeDeg: 120, fovDeg: 500, rollDeg: 0 })).toEqual({ azimuthDeg: 350, altitudeDeg: 90, fovDeg: MAX_FOV_DEG, rollDeg: 0 })
  })

  it('la stéréographique est conforme : un petit cercle reste un cercle', () => {
    const q = createProjector({ azimuthDeg: 0, altitudeDeg: 30, fovDeg: 120, rollDeg: 0 }, 'stereographic', VP)
    // Petit cercle de 2° autour d'un point excentré : rapport des axes ≈ 1.
    const c = fromHorizontal(50, 50)
    const pts = [0, 90, 180, 270].map((a) => project(q, fromHorizontal(50 + (2 * Math.sin((a * Math.PI) / 180)) / Math.cos((50 * Math.PI) / 180), 50 + 2 * Math.cos((a * Math.PI) / 180)))!)
    const center = project(q, c)!
    const radii = pts.map((s) => Math.hypot(s.x - center.x, s.y - center.y))
    expect(Math.max(...radii) / Math.min(...radii)).toBeLessThan(1.03)
  })
})
