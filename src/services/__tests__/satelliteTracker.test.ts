import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_TLES } from '../../data/tleFallback.generated'
import { setCacheStorage } from '../cache'
import {
  getGroundTrack,
  getSatelliteState,
  isTleLineValid,
  loadTleSet,
  parseTleText,
  pickTracked,
  predictPasses,
  tleAgeDays,
  tleChecksum,
  tleEpoch,
} from '../satelliteTracker'
import type { ObserverLocation } from '../../types/astro'
import { createMemoryStorage } from './memoryStorage'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const ISS = BUNDLED_TLES.find((r) => r.noradId === 25544)!
const TLE_TEXT = `${ISS.name}\n${ISS.line1}\n${ISS.line2}\n`
const textResponse = (body: string, ok = true) => ({ ok, status: ok ? 200 : 503, text: async () => body }) as Response

describe('TLE', () => {
  it('valide les sommes de contrôle', () => {
    expect(tleChecksum(ISS.line1)).toBe(Number(ISS.line1[68]))
    expect(isTleLineValid(ISS.line1, 1)).toBe(true)
    expect(isTleLineValid(ISS.line2, 2)).toBe(true)
    const corrupted = ISS.line1.slice(0, 20) + (ISS.line1[20] === '1' ? '2' : '1') + ISS.line1.slice(21)
    expect(isTleLineValid(corrupted, 1)).toBe(false)
    expect(isTleLineValid(ISS.line1, 2)).toBe(false)
  })

  it('analyse un texte multi-satellites et se resynchronise après un bloc invalide', () => {
    const text = `garbage line\n${TLE_TEXT}${BUNDLED_TLES.map((r) => `${r.name}\n${r.line1}\n${r.line2}`).join('\r\n')}`
    const records = parseTleText(text)
    expect(records.map((r) => r.noradId)).toEqual([25544, 25544, 48274, 20580])
    expect(records[0].name).toBe('ISS (ZARYA)')
  })

  it('déduit l’époque et l’âge des éléments', () => {
    const epoch = tleEpoch(ISS)
    expect(epoch.getUTCFullYear()).toBeGreaterThanOrEqual(2024)
    expect(tleAgeDays(ISS, new Date(epoch.getTime() + 2 * 86_400_000))).toBeCloseTo(2, 6)
  })
})

describe('propagation SGP4', () => {
  it('l’ISS orbite à ~400–430 km à ~7,66 km/s', () => {
    const state = getSatelliteState(ISS, tleEpoch(ISS), PARIS)!
    expect(state.altitudeKm).toBeGreaterThan(380)
    expect(state.altitudeKm).toBeLessThan(440)
    expect(state.speedKmS).toBeCloseTo(7.66, 1)
    expect(Math.abs(state.latitudeDeg)).toBeLessThanOrEqual(51.7)
    expect(state.shadowFraction).toBeGreaterThanOrEqual(0)
    expect(state.shadowFraction).toBeLessThanOrEqual(1)
    expect(state.rangeKm).toBeGreaterThan(state.altitudeKm - 1)
  })

  it('prédit des passages ordonnés et cohérents sur 48 h', () => {
    const start = tleEpoch(ISS)
    const passes = predictPasses(ISS, start, 48, PARIS, 10)
    expect(passes.length).toBeGreaterThan(2)
    for (const p of passes) {
      expect(p.rise.time < p.culmination.time && p.culmination.time < p.set.time).toBe(true)
      expect(Math.abs(p.rise.elevationDeg)).toBeLessThan(0.3)
      expect(Math.abs(p.set.elevationDeg)).toBeLessThan(0.3)
      expect(p.culmination.elevationDeg).toBeGreaterThanOrEqual(10)
      expect(p.durationSec).toBeGreaterThan(60)
      expect(p.durationSec).toBeLessThan(15 * 60)
      if (p.visible) expect(p.visibleFrom! <= p.visibleTo!).toBe(true)
      else expect(p.visibleFrom).toBeNull()
    }
  })

  it('trace au sol continue sur une orbite', () => {
    const track = getGroundTrack(ISS, tleEpoch(ISS), 93, 60)
    expect(track).toHaveLength(94)
    expect(Math.max(...track.map((p) => p.latitudeDeg))).toBeGreaterThan(45)
    expect(Math.min(...track.map((p) => p.latitudeDeg))).toBeLessThan(-45)
  })
})

describe('chargement des TLE', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('télécharge puis sert depuis le cache', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(TLE_TEXT))
    const first = await loadTleSet({ fetchImpl })
    expect(first.origin).toBe('network')
    expect(first.records).toHaveLength(1)
    expect(String(fetchImpl.mock.calls[0][0])).toContain('GROUP=visual')
    const second = await loadTleSet({ fetchImpl })
    expect(second.origin).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('bascule sur les TLE embarqués hors-ligne', async () => {
    const set = await loadTleSet({ fetchImpl: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) })
    expect(set.origin).toBe('bundled')
    expect(pickTracked(set).map((r) => r.noradId)).toEqual([25544, 48274, 20580])
  })

  it('rejette une réponse HTTP en erreur ou vide', async () => {
    expect((await loadTleSet({ fetchImpl: vi.fn().mockResolvedValue(textResponse('', false)) })).origin).toBe('bundled')
    expect((await loadTleSet({ fetchImpl: vi.fn().mockResolvedValue(textResponse('<html>')) })).origin).toBe('bundled')
  })

  it('complète la sélection suivie avec les TLE embarqués', () => {
    const set = { records: parseTleText(TLE_TEXT), fetchedAt: 0, origin: 'network' as const }
    expect(pickTracked(set, [25544, 20580, 99999]).map((r) => r.noradId)).toEqual([25544, 20580])
  })
})
