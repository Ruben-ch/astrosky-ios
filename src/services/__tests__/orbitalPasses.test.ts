import { describe, expect, it } from 'vitest'
import { BRIGHT_SATELLITE_MAGNITUDES, BRIGHT_SATELLITE_TLES } from '../../data/brightSatellites.generated'
import type { ObserverLocation } from '../../types/astro'
import { getSunGeometricAltitudeDeg } from '../astro/bodies'
import { resolveSkyObject, satelliteKey } from '../sky/skyObjects'
import { ALWAYS_INCLUDED, ISS_NORAD, TIANGONG_NORAD, satelliteDisplayName, selectCandidates, standardMagnitude } from '../satellite/brightCatalog'
import { angleBetweenDeg, illuminatedFraction, satelliteMagnitude } from '../satellite/magnitude'
import { SHADOW_THRESHOLD, SUN_MAX_ALT_DEG, TRACK_STEP_MS, bisect, ternaryMax } from '../satellite/passTrack'
import { BUNDLED_TLES, findTleRecord, mergeTleRecords, tleEpoch } from '../satellite/tle'
import { DEFAULT_PASS_OPTIONS, darkIntervals, nextPass, positionOnTrack, predictVisiblePasses, predictVisiblePassesAsync } from '../satellite/visiblePasses'
import { getSatelliteState, predictPasses } from '../satelliteTracker'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const START = new Date('2026-11-18T12:00:00Z')
const candidates = selectCandidates({ records: BUNDLED_TLES })
const passes = predictVisiblePasses(candidates, START, PARIS)

describe('magnitude des satellites', () => {
  it('formule standard : 1000 km, 50 % éclairé → magnitude standard', () => {
    expect(illuminatedFraction(90)).toBeCloseTo(0.5, 10)
    expect(satelliteMagnitude(-2.5, 1000, 90)).toBeCloseTo(-2.5, 10)
    // Distance ÷ 10 → +5 log10 : 5 magnitudes plus brillant.
    expect(satelliteMagnitude(1, 100, 90)).toBeCloseTo(-4, 10)
    // Pleine phase : deux fois plus de surface éclairée → 0,75 mag plus brillant.
    expect(satelliteMagnitude(0, 1000, 0)).toBeCloseTo(-2.5 * Math.log10(2), 10)
    // Pénombre à 50 % : moitié moins de lumière.
    expect(satelliteMagnitude(0, 1000, 90, 0.5)).toBeCloseTo(2.5 * Math.log10(2), 10)
    expect(satelliteMagnitude(0, 1000, 180)).toBeNull()
    expect(satelliteMagnitude(0, 1000, 90, 1)).toBeNull()
  })

  it('angle entre vecteurs', () => {
    expect(angleBetweenDeg({ x: 1, y: 0, z: 0 }, { x: 0, y: 2, z: 0 })).toBeCloseTo(90, 10)
    expect(angleBetweenDeg({ x: 1, y: 1, z: 0 }, { x: -1, y: -1, z: 0 })).toBeCloseTo(180, 4)
  })
})

describe('catalogue des satellites brillants', () => {
  it('magnitudes standard réelles (QuickSat, Heavens-Above pour la CSS)', () => {
    expect(standardMagnitude(ISS_NORAD)).toBe(-2.5)
    expect(BRIGHT_SATELLITE_MAGNITUDES[TIANGONG_NORAD].source).toBe('heavens-above')
    for (const m of Object.values(BRIGHT_SATELLITE_MAGNITUDES)) expect(m.stdMag).toBeLessThanOrEqual(2)
    expect(standardMagnitude(1)).toBeNull()
  })

  it('TLE de secours : orbite basse, sommes de contrôle valides, fusion par époque la plus récente', () => {
    expect(BRIGHT_SATELLITE_TLES.length).toBeGreaterThanOrEqual(20)
    expect(BUNDLED_TLES.some((r) => r.noradId === ISS_NORAD)).toBe(true)
    expect(new Set(BUNDLED_TLES.map((r) => r.noradId)).size).toBe(BUNDLED_TLES.length)
    const iss = BUNDLED_TLES.filter((r) => r.noradId === ISS_NORAD)
    expect(iss).toHaveLength(1)
    const older = { ...iss[0], line1: iss[0].line1.replace(/^(.{18})\d{2}/, '$124') }
    expect(mergeTleRecords([older], iss)[0]).toBe(tleEpoch(older) > tleEpoch(iss[0]) ? older : iss[0])
    expect(findTleRecord(ISS_NORAD)?.noradId).toBe(ISS_NORAD)
  })

  it('candidats : ISS et Tiangong en tête, puis magnitude croissante', () => {
    expect(candidates.slice(0, 2).map((c) => c.record.noradId).sort()).toEqual([...ALWAYS_INCLUDED].sort())
    const rest = candidates.slice(2).map((c) => c.stdMag!)
    for (let i = 1; i < rest.length; i++) expect(rest[i]).toBeGreaterThanOrEqual(rest[i - 1])
    expect(satelliteDisplayName({ noradId: ISS_NORAD, name: 'ISS (ZARYA)' })).toBe('ISS')
  })
})

describe('fenêtres de nuit et outils de recherche', () => {
  it('nuits sous −6° sur 48 h à Paris en novembre', () => {
    const w = darkIntervals(START, 48, PARIS)
    expect(w).toHaveLength(2)
    for (const i of w) {
      const h = (i.end.getTime() - i.start.getTime()) / 3_600_000
      expect(h).toBeGreaterThan(13)
      expect(h).toBeLessThan(15)
      expect(getSunGeometricAltitudeDeg(i.start, PARIS)).toBeCloseTo(SUN_MAX_ALT_DEG, 2)
    }
  })

  it('bissection et recherche ternaire à la seconde', () => {
    expect(Math.abs(bisect((t) => t >= 12_345_678, 0, 100_000_000) - 12_345_678)).toBeLessThan(1000)
    expect(Math.abs(ternaryMax((t) => -((t - 5_000_000) ** 2), 0, 20_000_000) - 5_000_000)).toBeLessThan(1000)
  })
})

describe('passages visibles sur 48 h', () => {
  it('trouve des passages visibles, triés, cohérents', () => {
    expect(passes.length).toBeGreaterThan(3)
    for (let i = 1; i < passes.length; i++) expect(passes[i].rise.time.getTime()).toBeGreaterThanOrEqual(passes[i - 1].rise.time.getTime())
    for (const p of passes) {
      expect(p.rise.time < p.culmination.time && p.culmination.time < p.set.time).toBe(true)
      expect(p.culmination.elevationDeg).toBeGreaterThanOrEqual(DEFAULT_PASS_OPTIONS.minCulminationDeg)
      expect(Math.abs(p.rise.elevationDeg)).toBeLessThan(0.2)
      expect(Math.abs(p.set.elevationDeg)).toBeLessThan(0.2)
      expect(p.set.time.getTime() - START.getTime()).toBeLessThanOrEqual(48 * 3_600_000 + 30 * 60_000)
      expect(p.track.length).toBeGreaterThan(5)
      expect(p.track[1].time.getTime() - p.track[0].time.getTime()).toBe(TRACK_STEP_MS)
      for (const pt of p.track) expect(pt.elevationDeg).toBeLessThanOrEqual(p.culmination.elevationDeg + 0.05)
      expect(p.visibleStart.time <= p.visibleEnd.time).toBe(true)
      expect(p.visibleDurationSec).toBeLessThanOrEqual(p.durationSec + 10)
      if (!ALWAYS_INCLUDED.includes(p.noradId)) expect(p.peakMagnitude!).toBeLessThan(2.5)
    }
  })

  it('la culmination correspond au maximum SGP4 et à predictPasses', () => {
    const iss = passes.find((p) => p.noradId === ISS_NORAD)
    expect(iss).toBeDefined()
    const ref = predictPasses(findTleRecord(ISS_NORAD)!, START, 48, PARIS, 10).find((p) => Math.abs(p.rise.time.getTime() - iss!.rise.time.getTime()) < 5000)
    expect(ref).toBeDefined()
    expect(iss!.culmination.elevationDeg).toBeCloseTo(ref!.culmination.elevationDeg, 1)
    expect(iss!.peakMagnitude!).toBeLessThan(0) // l'ISS est plus brillante que les étoiles de 1re grandeur
  })

  it('entrée / sortie de l’ombre de la Terre affinées et cohérentes avec la trajectoire', () => {
    const withEntry = passes.filter((p) => p.shadowEntry)
    expect(withEntry.length).toBeGreaterThan(0)
    for (const p of withEntry) {
      const e = p.shadowEntry!
      expect(e.time >= p.rise.time && e.time <= p.set.time).toBe(true)
      const before = p.track.filter((pt) => pt.time < e.time).at(-1)!
      const after = p.track.find((pt) => pt.time > e.time)!
      expect(before.sunlit && !after.sunlit).toBe(true)
      expect(after.shadowFraction).toBeGreaterThanOrEqual(SHADOW_THRESHOLD)
      expect(after.magnitude).toBeNull()
      expect(p.visibleEnd.time.getTime()).toBeLessThanOrEqual(e.time.getTime())
    }
  })

  it('position interpolée et prochain passage', () => {
    const p = passes[0]
    const mid = (p.rise.time.getTime() + p.set.time.getTime()) / 2
    const pos = positionOnTrack(p, mid)!
    const live = getSatelliteState(findTleRecord(p.noradId)!, new Date(mid), PARIS)!
    expect(pos.elevationDeg).toBeCloseTo(live.elevationDeg, 0)
    expect(positionOnTrack(p, p.rise.time.getTime() - 60_000)).toBeNull()
    expect(nextPass(passes, START.getTime())).toBe(passes[0])
    expect(nextPass(passes, Date.parse('2030-01-01'))).toBeNull()
  })

  it('version asynchrone : même résultat, progression et annulation', async () => {
    const sub = candidates.slice(0, 4)
    const progress: number[] = []
    const res = await predictVisiblePassesAsync(sub, START, PARIS, DEFAULT_PASS_OPTIONS, { sliceMs: 0, onProgress: (pr) => progress.push(pr.done) })
    expect(res.map((p) => p.id)).toEqual(predictVisiblePasses(sub, START, PARIS).map((p) => p.id))
    expect(progress.at(-1)).toBe(4)
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(predictVisiblePassesAsync(sub, START, PARIS, DEFAULT_PASS_OPTIONS, { signal: ctrl.signal })).rejects.toThrow(/annulée/)
  })
})

describe('guidage planétarium vers un satellite', () => {
  it('résout la clé SAT<norad> et suit la position SGP4', () => {
    const ref = resolveSkyObject(satelliteKey(ISS_NORAD), START, PARIS)!
    expect(ref).toMatchObject({ kind: 'satellite', label: 'ISS', noradId: ISS_NORAD })
    expect(resolveSkyObject('SAT1', START, PARIS)).toBeNull()
  })
})
