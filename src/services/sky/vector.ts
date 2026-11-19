/**
 * Algèbre vectorielle du planétarium dans le repère horizontal local ENU
 * (x = Est, y = Nord, z = Zénith). Géométrie pure : aucune éphéméride ici.
 */
import type { Vec3 } from '../../types/sky'

export const DEG = Math.PI / 180

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2])
  return l === 0 ? [0, 0, 1] : [a[0] / l, a[1] / l, a[2] / l]
}

/** Vecteur unitaire ENU d'une direction (azimut depuis le nord vers l'est, hauteur), degrés. */
export function fromHorizontal(azimuthDeg: number, altitudeDeg: number): Vec3 {
  const az = azimuthDeg * DEG
  const alt = altitudeDeg * DEG
  return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)]
}

/** Azimut [0, 360) et hauteur (degrés) d'un vecteur ENU. */
export function toHorizontal(v: Vec3): { azimuthDeg: number; altitudeDeg: number } {
  const n = normalize(v)
  const az = Math.atan2(n[0], n[1]) / DEG
  return { azimuthDeg: (az + 360) % 360, altitudeDeg: Math.asin(Math.max(-1, Math.min(1, n[2]))) / DEG }
}

/** Écart angulaire entre deux directions, degrés (formule atan2, stable aux petits angles). */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  return Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) / DEG
}

/** Normalise un azimut dans [0, 360). */
export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360
