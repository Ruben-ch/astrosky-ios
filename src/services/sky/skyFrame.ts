/**
 * Passage J2000 (EQJ) → horizontal local ENU pour un instant donné.
 * La matrice vient d'astronomy-engine (`Rotation_EQJ_HOR` : précession, nutation,
 * rotation terrestre), sa convention HOR (x = nord, y = ouest, z = zénith) est
 * convertie en ENU ; la réfraction atmosphérique utilise `Refraction('normal')`.
 * Les tableaux de vecteurs sont transformés en bloc (60 fps, sans allocation).
 */
import { MakeTime, Refraction, Rotation_EQJ_HOR, Spherical, VectorFromSphere } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import type { Vec3 } from '../../types/sky'
import { toObserver } from '../astro/bodies'
import { DEG } from './vector'

/** Matrice 3×3 ligne par ligne : ENU = M · EQJ. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export function eqjToEnuMatrix(date: Date, loc: ObserverLocation): Mat3 {
  // astronomy-engine : rot[i][j] = composante j (HOR) de l'axe i (EQJ) → HOR_j = Σ_i rot[i][j]·EQJ_i.
  const rot = Rotation_EQJ_HOR(MakeTime(date), toObserver(loc)).rot
  const hor = (j: number) => [rot[0][j], rot[1][j], rot[2][j]] as const
  const north = hor(0)
  const west = hor(1)
  const zenith = hor(2)
  return [-west[0], -west[1], -west[2], north[0], north[1], north[2], zenith[0], zenith[1], zenith[2]]
}

/** Vecteurs unitaires EQJ (tableau plat x, y, z) à partir de couples (raDeg, decDeg). */
export function eqjVectors(raDecDeg: ArrayLike<number>, stride = 2, raOffset = 0): Float64Array {
  const n = Math.floor(raDecDeg.length / stride)
  const out = new Float64Array(n * 3)
  const t = MakeTime(new Date(Date.UTC(2000, 0, 1, 12)))
  for (let i = 0; i < n; i++) {
    const v = VectorFromSphere(new Spherical(raDecDeg[i * stride + raOffset + 1], raDecDeg[i * stride + raOffset], 1), t)
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  return out
}

export function eqjVector(raDeg: number, decDeg: number): Vec3 {
  const v = eqjVectors([raDeg, decDeg])
  return [v[0], v[1], v[2]]
}

/**
 * Élévation apparente d'un vecteur ENU unitaire par la réfraction (in situ).
 * Comme HorizonFromVector, la correction est appliquée à toute hauteur
 * (astronomy-engine la plafonne lui-même sous −1°) : continuité à l'horizon.
 */
function refractInPlace(out: Float64Array, i: number): void {
  const z = out[i + 2]
  const altDeg = Math.asin(Math.max(-1, Math.min(1, z))) / DEG
  const bent = (altDeg + Refraction('normal', altDeg)) * DEG
  const h = Math.hypot(out[i], out[i + 1])
  if (h < 1e-12) return
  const k = Math.cos(bent) / h
  out[i] *= k
  out[i + 1] *= k
  out[i + 2] = Math.sin(bent)
}

/** dst = M · src pour chaque triplet ; réfraction optionnelle. */
export function transformVectors(m: Mat3, src: Float64Array, dst: Float64Array, refract = true): void {
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i]
    const y = src[i + 1]
    const z = src[i + 2]
    dst[i] = m[0] * x + m[1] * y + m[2] * z
    dst[i + 1] = m[3] * x + m[4] * y + m[5] * z
    dst[i + 2] = m[6] * x + m[7] * y + m[8] * z
    if (refract) refractInPlace(dst, i)
  }
}

export function transformVector(m: Mat3, v: Vec3, refract = true): Vec3 {
  const out = new Float64Array(3)
  transformVectors(m, Float64Array.from(v), out, refract)
  return [out[0], out[1], out[2]]
}
