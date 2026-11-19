/**
 * Données du planétarium préparées une fois : vecteurs J2000 des étoiles,
 * de la Voie lactée, des figures et étiquettes de constellations, du ciel
 * profond, des grilles équatoriales et de l'écliptique (Rotation_ECL_EQJ).
 * Le gros catalogue d'étoiles est chargé à la demande (chunk séparé).
 */
import { RotateVector, Rotation_ECL_EQJ, Spherical, VectorFromSphere, MakeTime } from 'astronomy-engine'
import { BRIGHT_STARS, CONSTELLATION_FIGURES, DEEP_SKY_CATALOG } from '../../data'
import type { DeepSkyObject } from '../../types/catalog'
import { eqjVectors } from './skyFrame'

export interface StarArrays {
  readonly count: number
  readonly hip: Int32Array
  readonly mag: Float32Array
  /** Indice B−V (NaN si inconnu). */
  readonly bv: Float32Array
  /** Vecteurs EQJ (x, y, z). */
  readonly eqj: Float64Array
  /** Phase pseudo-aléatoire stable de scintillation, radians. */
  readonly phase: Float32Array
}

export interface Polyline {
  /** Vecteurs EQJ des sommets (x, y, z). */
  readonly eqj: Float64Array
}

export interface SkyCatalog {
  readonly stars: StarArrays
  /** Nom propre par numéro Hipparcos (étoiles brillantes). */
  readonly starNames: ReadonlyMap<number, string>
  readonly milkyWay: { readonly eqj: Float64Array; readonly level: Uint8Array; readonly stepDeg: number }
  readonly constellationLines: readonly Polyline[]
  readonly constellationLabels: readonly { readonly id: string; readonly name: string; readonly eqj: Float64Array }[]
  readonly deepSky: readonly DeepSkyObject[]
  readonly deepSkyEqj: Float64Array
  /** Parallèles de déclinaison et cercles horaires (J2000), échantillonnés tous les 2°. */
  readonly equatorialGrid: readonly (Polyline & { readonly label: string; readonly isEquator: boolean })[]
  readonly ecliptic: Polyline
}

/** Phase de scintillation dérivée du numéro HIP (hachage entier déterministe). */
export function starPhase(hip: number): number {
  let h = hip | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return ((h >>> 0) / 0xffffffff) * Math.PI * 2
}

function polyline(raDecDeg: number[]): Polyline {
  return { eqj: eqjVectors(raDecDeg) }
}

export function buildEquatorialGrid(): SkyCatalog['equatorialGrid'] {
  const lines: (Polyline & { label: string; isEquator: boolean })[] = []
  for (let dec = -80; dec <= 80; dec += 10) {
    const pts: number[] = []
    for (let ra = 0; ra <= 360; ra += 2) pts.push(ra, dec)
    lines.push({ ...polyline(pts), label: `${dec > 0 ? '+' : dec < 0 ? '−' : ''}${Math.abs(dec)}°`, isEquator: dec === 0 })
  }
  for (let h = 0; h < 24; h++) {
    const pts: number[] = []
    for (let dec = -88; dec <= 88; dec += 2) pts.push(h * 15, dec)
    lines.push({ ...polyline(pts), label: `${h}h`, isEquator: false })
  }
  return lines
}

/** Écliptique J2000 : longitudes écliptiques 0…360° tournées par Rotation_ECL_EQJ. */
export function buildEcliptic(stepDeg = 2): Polyline {
  const rot = Rotation_ECL_EQJ()
  const t = MakeTime(new Date(Date.UTC(2000, 0, 1, 12)))
  const n = Math.round(360 / stepDeg) + 1
  const eqj = new Float64Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = RotateVector(rot, VectorFromSphere(new Spherical(0, i * stepDeg, 1), t))
    eqj.set([v.x, v.y, v.z], i * 3)
  }
  return { eqj }
}

let promise: Promise<SkyCatalog> | null = null

export function loadSkyCatalog(): Promise<SkyCatalog> {
  promise ??= import('../../data/sky.generated').then((m) => buildSkyCatalog(m))
  return promise
}

export function buildSkyCatalog(m: typeof import('../../data/sky.generated')): SkyCatalog {
  const S = m.SKY_STAR_STRIDE
  const count = m.SKY_STARS.length / S
  const hip = new Int32Array(count)
  const mag = new Float32Array(count)
  const bv = new Float32Array(count)
  const phase = new Float32Array(count)
  const raDec: number[] = []
  for (let i = 0; i < count; i++) {
    hip[i] = m.SKY_STARS[i * S]
    raDec.push(m.SKY_STARS[i * S + 1], m.SKY_STARS[i * S + 2])
    mag[i] = m.SKY_STARS[i * S + 3]
    bv[i] = m.SKY_STARS[i * S + 4]
    phase[i] = starPhase(hip[i])
  }
  const level = new Uint8Array(m.MILKY_WAY_POINTS.length / 3)
  for (let i = 0; i < level.length; i++) level[i] = m.MILKY_WAY_POINTS[i * 3 + 2]
  const nameFr = new Map(CONSTELLATION_FIGURES.map((c) => [c.id, c.nameFr]))
  return {
    stars: { count, hip, mag, bv, eqj: eqjVectors(raDec), phase },
    starNames: new Map(BRIGHT_STARS.filter((s) => s.name).map((s) => [s.hip, s.name!])),
    milkyWay: { eqj: eqjVectors(m.MILKY_WAY_POINTS, 3), level, stepDeg: m.MILKY_WAY_STEP_DEG },
    constellationLines: CONSTELLATION_FIGURES.flatMap((c) => c.polylines.map((pl) => polyline([...pl]))),
    constellationLabels: m.CONSTELLATION_LABELS.map(([id, ra, dec]) => ({ id, name: nameFr.get(id) ?? id, eqj: eqjVectors([ra, dec]) })),
    deepSky: DEEP_SKY_CATALOG,
    deepSkyEqj: eqjVectors(DEEP_SKY_CATALOG.flatMap((o) => [o.raDeg, o.decDeg])),
    equatorialGrid: buildEquatorialGrid(),
    ecliptic: buildEcliptic(),
  }
}
