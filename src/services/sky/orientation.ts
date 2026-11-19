/**
 * Capteurs inertiels iOS → direction de visée de la caméra arrière.
 * - Matrice d'orientation W3C (Euler Z-X'-Y'' : alpha, beta, gamma) ;
 * - alpha référencé au nord grâce à `webkitCompassHeading` (alphaAbs = 360° − cap) ;
 * - filtre passe-bas exponentiel sur les vecteurs (pas sur les angles : aucun saut
 *   à 0°/360°), constante de temps indépendante de la cadence des évènements.
 * Repère monde W3C : x = Est, y = Nord, z = Haut (identique à l'ENU du planétarium).
 */
import type { CameraPose, OrientationSample, SkyView, Vec3 } from '../../types/sky'
import { DEG, cross, dot, normalize, toHorizontal } from './vector'

/** Alpha absolu (degrés) : cap boussole iOS si disponible, sinon alpha absolu natif. */
export function absoluteAlphaDeg(s: OrientationSample): number | null {
  if (s.compassHeadingDeg !== null && Number.isFinite(s.compassHeadingDeg)) return (360 - s.compassHeadingDeg) % 360
  if (s.absolute && s.alphaDeg !== null) return s.alphaDeg
  return s.alphaDeg
}

/**
 * Pose de la caméra : direction = −(3e colonne de R), haut d'écran = 2e colonne,
 * avec R = Rz(alpha)·Rx(beta)·Ry(gamma). `null` si les angles sont absents.
 */
export function cameraPoseFromOrientation(s: OrientationSample): CameraPose | null {
  const alpha = absoluteAlphaDeg(s)
  if (alpha === null || s.betaDeg === null || s.gammaDeg === null) return null
  const a = alpha * DEG
  const b = s.betaDeg * DEG
  const g = s.gammaDeg * DEG
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g)
  const col2: Vec3 = [-sa * cb, ca * cb, sb]
  const col3: Vec3 = [ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg]
  return { direction: normalize([-col3[0], -col3[1], -col3[2]]), up: normalize(col2) }
}

/**
 * Vue du planétarium correspondant à une pose : azimut/hauteur de la direction,
 * roulis = angle entre le haut de l'écran et le « haut » local (vers le zénith).
 */
export function viewFromPose(pose: CameraPose, fovDeg: number): SkyView {
  const { azimuthDeg, altitudeDeg } = toHorizontal(pose.direction)
  const az = azimuthDeg * DEG
  const r0: Vec3 = [Math.cos(az), -Math.sin(az), 0]
  const u0 = cross(r0, pose.direction)
  const rollDeg = Math.atan2(-dot(pose.up, r0), dot(pose.up, u0)) / DEG
  return { azimuthDeg, altitudeDeg, fovDeg, rollDeg }
}

/** Filtre passe-bas exponentiel sur la pose (direction et haut), `tauMs` = constante de temps. */
export class OrientationFilter {
  private dir: Vec3 | null = null
  private up: Vec3 | null = null
  private lastMs = 0
  private readonly tauMs: number

  constructor(tauMs = 120) {
    this.tauMs = tauMs
  }

  reset(): void {
    this.dir = null
    this.up = null
  }

  /** Coefficient de lissage pour un intervalle `dtMs` : 1 − e^(−dt/τ). */
  static alpha(dtMs: number, tauMs: number): number {
    if (dtMs <= 0) return 0
    return 1 - Math.exp(-dtMs / tauMs)
  }

  update(pose: CameraPose, timeMs: number): CameraPose {
    if (!this.dir || !this.up) {
      this.dir = pose.direction
      this.up = pose.up
    } else {
      const k = OrientationFilter.alpha(Math.min(timeMs - this.lastMs, 500), this.tauMs)
      const mix = (a: Vec3, b: Vec3): Vec3 => normalize([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k])
      this.dir = mix(this.dir, pose.direction)
      // Le haut est réorthogonalisé par rapport à la direction filtrée.
      const u = mix(this.up, pose.up)
      const d = this.dir
      const p = dot(u, d)
      this.up = normalize([u[0] - p * d[0], u[1] - p * d[1], u[2] - p * d[2]])
    }
    this.lastMs = timeMs
    return { direction: this.dir, up: this.up }
  }
}

/** Convertit un DeviceOrientationEvent (ou équivalent) en échantillon typé. */
export function sampleFromEvent(
  e: { alpha: number | null; beta: number | null; gamma: number | null; absolute?: boolean; webkitCompassHeading?: number },
  timeMs: number,
): OrientationSample {
  const heading = typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0 ? e.webkitCompassHeading : null
  return { alphaDeg: e.alpha, betaDeg: e.beta, gammaDeg: e.gamma, compassHeadingDeg: heading, absolute: e.absolute === true, timeMs }
}
