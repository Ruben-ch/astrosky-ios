import { beforeEach, describe, expect, it } from 'vitest'
import { GALILEAN_MOONS, ORRERY_BODIES, ORRERY_PLANETS } from '../../data/solarSystemPhysical'
import { setCacheStorage } from '../cache'
import { buildMoonOrbit, buildPlanetOrbit, bucketEpoch, clearOrbitMemory, loadOrbitSet, orbitSetKey, PLANET_BUCKET_MS } from '../orrery/orbits'
import { computeOrrerySnapshot } from '../orrery/positions'
import {
  compressHelioDistance,
  compressJovicentricDistance,
  eclToSceneAxes,
  helioEclToScene,
  jovicentricEclToScene,
  visualRadius,
} from '../orrery/visualScale'
import type { Vec3 } from '../../types/orrery'
import { createMemoryStorage } from './memoryStorage'

const len = (v: ArrayLike<number>) => Math.hypot(v[0], v[1], v[2])
const DATE = new Date('2026-11-18T21:00:00Z')

describe('échelle visuelle', () => {
  it('conserve les directions et compresse les distances en racine carrée', () => {
    const v: Vec3 = [3, -4, 0]
    const s = helioEclToScene(v)
    expect(len(s)).toBeCloseTo(compressHelioDistance(5), 10)
    // Axes : x → x, y_ecl → −z, z_ecl → +y.
    expect(s[0] / len(s)).toBeCloseTo(0.6, 10)
    expect(s[2] / len(s)).toBeCloseTo(0.8, 10)
    expect(eclToSceneAxes([0, 0, 1])).toEqual([0, 1, -0])
    expect(helioEclToScene([0, 0, 0])).toEqual([0, 0, 0])
  })

  it('préserve l’ordre des distances et des tailles', () => {
    expect(compressHelioDistance(0.39)).toBeLessThan(compressHelioDistance(1))
    expect(compressHelioDistance(30)).toBeGreaterThan(compressHelioDistance(19))
    const radii = ORRERY_PLANETS.map(visualRadius)
    expect(visualRadius('Jupiter')).toBe(Math.max(...radii))
    expect(visualRadius('Mercury')).toBe(Math.min(...radii))
    expect(visualRadius('Ganymede')).toBeGreaterThan(visualRadius('Europa'))
    expect(visualRadius('Sun')).toBeGreaterThan(visualRadius('Jupiter'))
  })

  it('le Soleil ne recouvre jamais Mercure au périhélie (0,3075 UA)', () => {
    expect(compressHelioDistance(0.3075) - visualRadius('Mercury')).toBeGreaterThan(visualRadius('Sun') * 1.6)
  })

  it('les lunes galiléennes restent hors du globe de Jupiter, dans l’ordre', () => {
    expect(compressJovicentricDistance(5.9)).toBeGreaterThan(visualRadius('Jupiter') + visualRadius('Io'))
    expect(compressJovicentricDistance(26.3)).toBeGreaterThan(compressJovicentricDistance(15))
    const off = jovicentricEclToScene([0.0028, 0, 0])
    expect(off[1]).toBe(0)
    expect(off[0]).toBeGreaterThan(0)
  })
})

describe('instantané des positions', () => {
  const snap = computeOrrerySnapshot(DATE)

  it('contient les 13 astres avec des vecteurs finis', () => {
    expect(Object.keys(snap.bodies).sort()).toEqual([...ORRERY_BODIES].sort())
    for (const b of Object.values(snap.bodies)) {
      for (const v of [...b.helioEclAu, ...b.scene, ...b.northScene, b.spinDeg]) expect(Number.isFinite(v)).toBe(true)
      expect(len(b.northScene)).toBeCloseTo(1, 6)
    }
    expect(snap.timeMs).toBe(DATE.getTime())
  })

  it('place la Terre à l’opposé du Soleil vu de la Terre à l’équinoxe de mars', () => {
    // Équinoxe du 20 mars 2026 à 14:46 UTC : longitude géocentrique du Soleil = 0°.
    const earth = computeOrrerySnapshot(new Date('2026-03-20T14:46:00Z')).bodies.Earth
    const [x, y, z] = earth.helioEclAu
    expect(Math.hypot(x, y, z)).toBeCloseTo(0.996, 2)
    expect((Math.atan2(y, x) * 180) / Math.PI).toBeCloseTo(180, 0)
    expect(Math.abs(z)).toBeLessThan(1e-4)
    expect(earth.scene[0]).toBeLessThan(-2.9)
  })

  it('donne des distances héliocentriques dans les bornes orbitales réelles', () => {
    const bounds: Record<string, [number, number]> = {
      Mercury: [0.307, 0.467], Venus: [0.718, 0.729], Earth: [0.983, 1.017], Mars: [1.381, 1.666],
      Jupiter: [4.95, 5.46], Saturn: [9.0, 10.1], Uranus: [18.2, 20.1], Neptune: [29.8, 30.4],
    }
    for (const id of ORRERY_PLANETS) {
      const r = len(snap.bodies[id].helioEclAu)
      expect(r, id).toBeGreaterThan(bounds[id][0])
      expect(r, id).toBeLessThan(bounds[id][1])
    }
  })

  it('place les lunes galiléennes à leur distance réelle de Jupiter', () => {
    const smaKm: Record<string, number> = { Io: 421_700, Europa: 671_034, Ganymede: 1_070_412, Callisto: 1_882_709 }
    for (const id of GALILEAN_MOONS) {
      const m = snap.bodies[id]
      const j = snap.bodies.Jupiter
      const dKm = len([m.helioEclAu[0] - j.helioEclAu[0], m.helioEclAu[1] - j.helioEclAu[1], m.helioEclAu[2] - j.helioEclAu[2]]) * 149_597_870.7
      expect(dKm / smaKm[id], id).toBeGreaterThan(0.97)
      expect(dKm / smaKm[id], id).toBeLessThan(1.03)
      const sceneOffset = len([m.scene[0] - j.scene[0], m.scene[1] - j.scene[1], m.scene[2] - j.scene[2]])
      expect(sceneOffset).toBeGreaterThan(visualRadius('Jupiter'))
    }
  })

  it('oriente l’axe de la Terre à 23,44° du pôle écliptique (+Y)', () => {
    const n = snap.bodies.Earth.northScene
    expect((Math.acos(n[1]) * 180) / Math.PI).toBeCloseTo(23.44, 1)
  })
})

describe('orbites tracées', () => {
  it('ferme la boucle de Mercure entre son périhélie et son aphélie, inclinaison comprise', () => {
    const track = buildPlanetOrbit('Mercury', DATE.getTime(), 180)
    const n = track.points.length / 3
    expect(n).toBe(181)
    expect(Array.from(track.points.slice(-3))).toEqual(Array.from(track.points.slice(0, 3)))
    let minR = Infinity
    let maxR = 0
    let maxY = 0
    for (let i = 0; i < n; i++) {
      const p = track.points.subarray(i * 3, i * 3 + 3)
      minR = Math.min(minR, len(p))
      maxR = Math.max(maxR, len(p))
      maxY = Math.max(maxY, Math.abs(p[1]))
    }
    expect(minR).toBeCloseTo(compressHelioDistance(0.3075), 2)
    expect(maxR).toBeCloseTo(compressHelioDistance(0.4667), 2)
    // Inclinaison de 7° : l'orbite sort nettement du plan de l'écliptique.
    expect(maxY).toBeGreaterThan(0.15)
    expect(track.periodDays).toBeCloseTo(87.97, 1)
  })

  it('passe par la position courante de chaque planète', () => {
    const snap = computeOrrerySnapshot(DATE)
    for (const id of ORRERY_PLANETS) {
      const track = buildPlanetOrbit(id, DATE.getTime(), 360)
      const p = snap.bodies[id].scene
      let best = Infinity
      for (let i = 0; i < track.points.length; i += 3) best = Math.min(best, Math.hypot(track.points[i] - p[0], track.points[i + 1] - p[1], track.points[i + 2] - p[2]))
      // Au plus un demi-pas d'échantillonnage (2π r / 720).
      expect(best, id).toBeLessThan((2 * Math.PI * len(p)) / 700)
    }
  })

  it('trace les orbites jovicentriques autour du globe de Jupiter', () => {
    const io = buildMoonOrbit('Io', DATE.getTime(), 64)
    const callisto = buildMoonOrbit('Callisto', DATE.getTime(), 64)
    expect(len(io.points.subarray(0, 3))).toBeCloseTo(compressJovicentricDistance(5.9), 1)
    expect(len(callisto.points.subarray(0, 3))).toBeGreaterThan(len(io.points.subarray(0, 3)))
  })
})

describe('cache des orbites', () => {
  let mem: ReturnType<typeof createMemoryStorage>
  beforeEach(() => {
    mem = createMemoryStorage()
    setCacheStorage(mem)
    clearOrbitMemory()
  })

  it('persiste puis relit le jeu d’orbites hors-ligne', async () => {
    const first = await loadOrbitSet(DATE.getTime())
    expect(first.planets).toHaveLength(8)
    expect(first.moons).toHaveLength(4)
    const raw = mem.data.get('astrosky:orrery:orbits:v1:planets')
    expect(raw).toBeDefined()
    // Marque l'entrée persistée : la relecture doit venir du cache, pas d'un recalcul.
    const entry = JSON.parse(raw!)
    entry.value.tracks[0].points[0] = 42
    mem.data.set('astrosky:orrery:orbits:v1:planets', JSON.stringify(entry))
    clearOrbitMemory()
    const second = await loadOrbitSet(DATE.getTime())
    expect(second.planets[0].points[0]).toBe(42)
    expect(second.planets[3].points[5]).toBeCloseTo(first.planets[3].points[5], 3)
  })

  it('recalcule si l’entrée est corrompue ou d’une autre époque', async () => {
    mem.data.set('astrosky:orrery:orbits:v1:planets', JSON.stringify({ value: { epochMs: 1, tracks: [] }, storedAt: Date.now(), ttlMs: 1e12 }))
    const set = await loadOrbitSet(DATE.getTime())
    expect(set.planets).toHaveLength(8)
    const stored = JSON.parse(mem.data.get('astrosky:orrery:orbits:v1:planets')!)
    expect(stored.value.epochMs).toBe(bucketEpoch(DATE.getTime(), PLANET_BUCKET_MS))
  })

  it('change de clé uniquement en franchissant une tranche d’époque', () => {
    const t = DATE.getTime()
    expect(orbitSetKey(t)).toBe(orbitSetKey(t + 3_600_000))
    expect(orbitSetKey(t)).not.toBe(orbitSetKey(t + 40 * 86_400_000))
  })
})
