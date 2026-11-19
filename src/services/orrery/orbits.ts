/**
 * Orbites réelles tracées en 3D : chaque trajectoire est échantillonnée
 * directement dans les éphémérides d'astronomy-engine sur une période complète
 * (`PlanetOrbitalPeriod` pour les planètes, périodes sidérales NSSDCA pour les
 * lunes galiléennes), centrée sur l'instant simulé. L'ellipse, son inclinaison
 * et l'orientation de son périhélie sont donc celles du modèle VSOP87 / E5.
 *
 * Coût : ≈ 20 ms pour les 8 planètes. Les tracés sont mémorisés en mémoire et
 * persistés hors-ligne (cache TTL) par tranche d'époque : une orbite planétaire
 * ne dérive visiblement qu'à l'échelle des siècles.
 */
import { HelioVector, JupiterMoons, PlanetOrbitalPeriod } from 'astronomy-engine'
import { GALILEAN_MOONS, GALILEAN_PERIOD_DAYS, ORRERY_PLANETS } from '../../data/solarSystemPhysical'
import type { GalileanMoonId, OrbitTrack, PlanetId } from '../../types/orrery'
import { cacheGet, cacheSet } from '../cache'
import { engineBody, eqjToEcl, MOON_KEY } from './positions'
import { helioEclToScene, jovicentricEclToScene } from './visualScale'

const DAY_MS = 86_400_000
export const PLANET_ORBIT_SAMPLES = 360
export const MOON_ORBIT_SAMPLES = 128
/** Tranche d'époque des orbites planétaires : 10 ans. */
export const PLANET_BUCKET_MS = 3_652.5 * DAY_MS
/** Tranche d'époque des orbites jovicentriques : 30 jours (précession nodale lente). */
export const MOON_BUCKET_MS = 30 * DAY_MS
const CACHE_VERSION = 1
const CACHE_TTL_MS = 180 * DAY_MS

export function orbitalPeriodDays(id: PlanetId): number {
  return PlanetOrbitalPeriod(engineBody(id))
}

function closeLoop(points: Float32Array): Float32Array {
  const n = points.length / 3
  points.copyWithin((n - 1) * 3, 0, 3)
  return points
}

/** Orbite héliocentrique d'une planète (scène), `samples` segments sur une période autour de `epochMs`. */
export function buildPlanetOrbit(id: PlanetId, epochMs: number, samples = PLANET_ORBIT_SAMPLES): OrbitTrack {
  const periodDays = orbitalPeriodDays(id)
  const body = engineBody(id)
  const points = new Float32Array((samples + 1) * 3)
  for (let i = 0; i < samples; i++) {
    const date = new Date(epochMs + (i / samples - 0.5) * periodDays * DAY_MS)
    const h = HelioVector(body, date)
    points.set(helioEclToScene(eqjToEcl(h.x, h.y, h.z, h.t)), i * 3)
  }
  return { id, epochMs, periodDays, points: closeLoop(points) }
}

/** Orbite jovicentrique d'une lune galiléenne (décalages de scène autour de Jupiter). */
export function buildMoonOrbit(id: GalileanMoonId, epochMs: number, samples = MOON_ORBIT_SAMPLES): OrbitTrack {
  const periodDays = GALILEAN_PERIOD_DAYS[id]
  const points = new Float32Array((samples + 1) * 3)
  for (let i = 0; i < samples; i++) {
    const date = new Date(epochMs + (i / samples - 0.5) * periodDays * DAY_MS)
    const s = JupiterMoons(date)[MOON_KEY[id]]
    points.set(jovicentricEclToScene(eqjToEcl(s.x, s.y, s.z, s.t)), i * 3)
  }
  return { id, epochMs, periodDays, points: closeLoop(points) }
}

/** Centre de la tranche d'époque contenant `ms`. */
export function bucketEpoch(ms: number, bucketMs: number): number {
  return (Math.floor(ms / bucketMs) + 0.5) * bucketMs
}

export interface OrbitSet {
  readonly planets: readonly OrbitTrack[]
  readonly moons: readonly OrbitTrack[]
}

interface StoredTrack {
  readonly id: OrbitTrack['id']
  readonly epochMs: number
  readonly periodDays: number
  /** Sommets arrondis à 1e-4 unité de scène. */
  readonly points: number[]
}

function toStored(t: OrbitTrack): StoredTrack {
  return { id: t.id, epochMs: t.epochMs, periodDays: t.periodDays, points: Array.from(t.points, (v) => Math.round(v * 1e4) / 1e4) }
}

function fromStored(raw: unknown, expectedCount: number): OrbitTrack[] | null {
  if (!Array.isArray(raw) || raw.length !== expectedCount) return null
  const out: OrbitTrack[] = []
  for (const s of raw as StoredTrack[]) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.points) || s.points.length % 3 !== 0) return null
    out.push({ id: s.id, epochMs: s.epochMs, periodDays: s.periodDays, points: Float32Array.from(s.points) })
  }
  return out
}

const MEMORY_LIMIT = 8
const memory = new Map<string, readonly OrbitTrack[]>()

interface StoredSet {
  readonly epochMs: number
  readonly tracks: StoredTrack[]
}

/**
 * Mémoire → cache persistant → calcul. Une seule entrée persistée par famille
 * (`planets`, `moons`) : un voyage dans le temps sur des siècles ne remplit pas le stockage.
 */
async function cachedTracks(kind: 'planets' | 'moons', epochMs: number, count: number, build: () => OrbitTrack[]): Promise<readonly OrbitTrack[]> {
  const memKey = `${kind}:${epochMs}`
  const hit = memory.get(memKey)
  if (hit) return hit
  const storageKey = `orrery:orbits:v${CACHE_VERSION}:${kind}`
  const entry = await cacheGet<StoredSet>(storageKey)
  const stored = entry?.epochMs === epochMs ? fromStored(entry.tracks, count) : null
  const tracks = stored ?? build()
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value as string)
  memory.set(memKey, tracks)
  if (!stored) await cacheSet<StoredSet>(storageKey, { epochMs, tracks: tracks.map(toStored) }, CACHE_TTL_MS)
  return tracks
}

/** Orbites des 8 planètes et des 4 lunes galiléennes valables autour de `simMs`. */
export async function loadOrbitSet(simMs: number): Promise<OrbitSet> {
  const pEpoch = bucketEpoch(simMs, PLANET_BUCKET_MS)
  const mEpoch = bucketEpoch(simMs, MOON_BUCKET_MS)
  const [planets, moons] = await Promise.all([
    cachedTracks('planets', pEpoch, ORRERY_PLANETS.length, () => ORRERY_PLANETS.map((id) => buildPlanetOrbit(id, pEpoch))),
    cachedTracks('moons', mEpoch, GALILEAN_MOONS.length, () => GALILEAN_MOONS.map((id) => buildMoonOrbit(id, mEpoch))),
  ])
  return { planets, moons }
}

/** Clé d'identité du jeu d'orbites pour `simMs` (change quand une tranche est franchie). */
export function orbitSetKey(simMs: number): string {
  return `${bucketEpoch(simMs, PLANET_BUCKET_MS)}:${bucketEpoch(simMs, MOON_BUCKET_MS)}`
}

/** Vide le cache mémoire (tests). */
export function clearOrbitMemory(): void {
  memory.clear()
}
