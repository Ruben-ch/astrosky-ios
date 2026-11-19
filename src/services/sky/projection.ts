/**
 * Projections azimutales du planétarium, centrées sur la direction de visée :
 * - stéréographique (conforme : formes des constellations préservées) r = 2·tan(θ/2) ;
 * - équidistante (distances au centre préservées) r = θ ;
 * - gnomonique (rectilinéaire, optique d'un objectif photo, mode AR) r = tan θ.
 * θ est l'écart angulaire au centre. Inverse exacte fournie pour le pan et le toucher.
 */
import type { ProjectionKind, ScreenPoint, SkyView, Vec3, Viewport } from '../../types/sky'
import { DEG, cross, fromHorizontal, normalize, toHorizontal, wrap360 } from './vector'

export const MIN_FOV_DEG = 1
export const MAX_FOV_DEG = 150
/** Au-delà de cet écart au centre, un point n'est pas dessiné (explosion stéréographique). */
export const MAX_DRAW_ANGLE_DEG = 120
/** Gnomonique : r = tan θ diverge à 90° ; on ne dessine pas au-delà de cet écart. */
export const GNOMONIC_MAX_DRAW_ANGLE_DEG = 78
const PAN_ITERATIONS = 6

export interface ViewBasis {
  /** Axe de visée. */
  readonly f: Vec3
  /** Droite de l'écran. */
  readonly r: Vec3
  /** Haut de l'écran. */
  readonly u: Vec3
}

/** Base orthonormée de la caméra ; la droite reste horizontale avant application du roulis. */
export function viewBasis(view: SkyView): ViewBasis {
  const az = view.azimuthDeg * DEG
  const f = fromHorizontal(view.azimuthDeg, view.altitudeDeg)
  const r0: Vec3 = [Math.cos(az), -Math.sin(az), 0]
  const u0 = cross(r0, f)
  const roll = view.rollDeg * DEG
  const c = Math.cos(roll)
  const s = Math.sin(roll)
  return {
    f,
    r: normalize([r0[0] * c + u0[0] * s, r0[1] * c + u0[1] * s, r0[2] * c + u0[2] * s]),
    u: normalize([u0[0] * c - r0[0] * s, u0[1] * c - r0[1] * s, u0[2] * c - r0[2] * s]),
  }
}

/** Rayon projeté (unités de sphère unité) pour un écart θ (radians). */
export function projectedRadius(kind: ProjectionKind, thetaRad: number): number {
  if (kind === 'gnomonic') return Math.tan(thetaRad)
  return kind === 'stereographic' ? 2 * Math.tan(thetaRad / 2) : thetaRad
}

/** Écart θ (radians) correspondant à un rayon projeté. */
export function inverseRadius(kind: ProjectionKind, rho: number): number {
  if (kind === 'gnomonic') return Math.atan(rho)
  return kind === 'stereographic' ? 2 * Math.atan(rho / 2) : rho
}

/** Pixels CSS par unité projetée : le champ horizontal remplit la largeur. */
export function pixelScale(kind: ProjectionKind, fovDeg: number, width: number): number {
  return width / 2 / projectedRadius(kind, (fovDeg / 2) * DEG)
}

export interface Projector {
  readonly basis: ViewBasis
  readonly kind: ProjectionKind
  readonly scale: number
  readonly cx: number
  readonly cy: number
  /** Cosinus minimal de l'écart au centre pour dessiner un point. */
  readonly minCos: number
}

export function createProjector(view: SkyView, kind: ProjectionKind, viewport: Viewport): Projector {
  return {
    basis: viewBasis(view),
    kind,
    scale: pixelScale(kind, view.fovDeg, viewport.width),
    cx: viewport.width / 2,
    cy: viewport.height / 2,
    minCos: Math.cos((kind === 'gnomonic' ? GNOMONIC_MAX_DRAW_ANGLE_DEG : MAX_DRAW_ANGLE_DEG) * DEG),
  }
}

/** Projette un vecteur ENU unitaire (composantes séparées : boucles sans allocation). */
export function projectXYZ(p: Projector, x: number, y: number, z: number): ScreenPoint | null {
  const { f, r, u } = p.basis
  const cz = x * f[0] + y * f[1] + z * f[2]
  if (cz < p.minCos) return null
  const cx = x * r[0] + y * r[1] + z * r[2]
  const cy = x * u[0] + y * u[1] + z * u[2]
  let k: number
  if (p.kind === 'stereographic') k = 2 / (1 + cz)
  else if (p.kind === 'gnomonic') k = 1 / cz
  else {
    const s = Math.hypot(cx, cy)
    k = s < 1e-12 ? 1 : Math.atan2(s, cz) / s
  }
  return { x: p.cx + cx * k * p.scale, y: p.cy - cy * k * p.scale, cosFromCenter: cz }
}

export const project = (p: Projector, v: Vec3) => projectXYZ(p, v[0], v[1], v[2])

/** Direction ENU sous un point d'écran (inverse exacte de la projection). */
export function unproject(p: Projector, sx: number, sy: number): Vec3 {
  const X = (sx - p.cx) / p.scale
  const Y = -(sy - p.cy) / p.scale
  const rho = Math.hypot(X, Y)
  if (rho < 1e-12) return p.basis.f
  const theta = inverseRadius(p.kind, rho)
  const { f, r, u } = p.basis
  const s = Math.sin(theta) / rho
  const c = Math.cos(theta)
  return normalize([f[0] * c + (r[0] * X + u[0] * Y) * s, f[1] * c + (r[1] * X + u[1] * Y) * s, f[2] * c + (r[2] * X + u[2] * Y) * s])
}

export function clampFov(fovDeg: number): number {
  return Math.min(MAX_FOV_DEG, Math.max(MIN_FOV_DEG, fovDeg))
}

/** Vue normalisée : azimut dans [0, 360), hauteur dans [−90, 90], champ borné. */
export function normalizeView(v: SkyView): SkyView {
  return { azimuthDeg: wrap360(v.azimuthDeg), altitudeDeg: Math.max(-90, Math.min(90, v.altitudeDeg)), fovDeg: clampFov(v.fovDeg), rollDeg: v.rollDeg }
}

/**
 * Pan « attrapé » : la direction initialement sous le doigt reste sous le doigt
 * (à la butée du zénith/nadir près, où la hauteur est bornée).
 * Renvoie la nouvelle vue pour un glissement de (fromX, fromY) vers (toX, toY).
 */
export function panView(view: SkyView, kind: ProjectionKind, viewport: Viewport, fromX: number, fromY: number, toX: number, toY: number): SkyView {
  const grabbed = toHorizontal(unproject(createProjector(view, kind, viewport), fromX, fromY))
  // Point fixe : on corrige la vue jusqu'à ce que la direction saisie retombe sous le doigt.
  let v = view
  for (let i = 0; i < PAN_ITERATIONS; i++) {
    const now = toHorizontal(unproject(createProjector(v, kind, viewport), toX, toY))
    const dAz = ((grabbed.azimuthDeg - now.azimuthDeg + 540) % 360) - 180
    const dAlt = grabbed.altitudeDeg - now.altitudeDeg
    v = normalizeView({ ...v, azimuthDeg: v.azimuthDeg + dAz, altitudeDeg: v.altitudeDeg + dAlt })
    if (Math.abs(dAz) * Math.cos(now.altitudeDeg * DEG) + Math.abs(dAlt) < 1e-4) break
  }
  return v
}

/** Zoom autour d'un point d'écran (pinch) : la direction sous le pivot reste fixe. */
export function zoomView(view: SkyView, kind: ProjectionKind, viewport: Viewport, factor: number, pivotX: number, pivotY: number): SkyView {
  const before = unproject(createProjector(view, kind, viewport), pivotX, pivotY)
  const zoomed = normalizeView({ ...view, fovDeg: view.fovDeg / factor })
  const p = createProjector(zoomed, kind, viewport)
  const pt = project(p, before)
  if (!pt) return zoomed
  return panView(zoomed, kind, viewport, pt.x, pt.y, pivotX, pivotY)
}
