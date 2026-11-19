/**
 * Garde de validité des éléments orbitaux : au-delà de ±30 jours autour de
 * l'époque TLE, positions, traces et passages sont masqués (pas de donnée fictive).
 */
import { describe, expect, it } from 'vitest'
import { BUNDLED_TLES } from '../../data/tleFallback.generated'
import { selectCandidates } from '../satellite/brightCatalog'
import { createSampler } from '../satellite/passTrack'
import { TLE_VALIDITY_DAYS, TLE_VALIDITY_MESSAGE, isTleValidAt, tleEpoch } from '../satellite/tle'
import { predictVisiblePasses } from '../satellite/visiblePasses'
import { getGroundTrack, getSatelliteState, predictPasses, propagateRaw } from '../satelliteTracker'
import { isSatelliteUnavailable, objectDirection, satelliteRef } from '../sky/skyObjects'
import { eqjToEnuMatrix } from '../sky/skyFrame'
import type { ObserverLocation } from '../../types/astro'

const PARIS: ObserverLocation = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const DAY = 86_400_000
const ISS = BUNDLED_TLES.find((r) => r.noradId === 25544)!
const epochMs = tleEpoch(ISS).getTime()
const at = (days: number) => new Date(epochMs + days * DAY)

describe('fenêtre de validité TLE (±30 j)', () => {
  it('bornes inclusives autour de l’époque, symétriques passé / futur', () => {
    expect(TLE_VALIDITY_DAYS).toBe(30)
    expect(isTleValidAt(ISS, at(0))).toBe(true)
    expect(isTleValidAt(ISS, at(29.99))).toBe(true)
    expect(isTleValidAt(ISS, at(-29.99))).toBe(true)
    expect(isTleValidAt(ISS, at(30.01))).toBe(false)
    expect(isTleValidAt(ISS, at(-30.01))).toBe(false)
    expect(TLE_VALIDITY_MESSAGE).toBe('Prédictions orbitales limitées à ±30 jours autour de la date des données TLE')
  })

  it('position SGP4 disponible dans la fenêtre, masquée au-delà', () => {
    expect(propagateRaw(ISS, at(1), PARIS)).not.toBeNull()
    expect(getSatelliteState(ISS, at(1), PARIS)).not.toBeNull()
    expect(propagateRaw(ISS, at(45), PARIS)).toBeNull()
    expect(propagateRaw(ISS, at(-45), PARIS)).toBeNull()
    expect(getSatelliteState(ISS, at(365), PARIS)).toBeNull()
  })

  it('échantillonneur du radar : hauteur −90 et échantillon nul hors fenêtre', () => {
    const sampler = createSampler(ISS, PARIS)
    expect(sampler.elevation(at(1).getTime())).toBeGreaterThan(-90)
    expect(sampler.elevation(at(31).getTime())).toBe(-90)
    expect(sampler.sample(at(31).getTime(), { stdMag: -1.8 })).toBeNull()
  })

  it('aucun passage ni trace au sol au-delà de la fenêtre', () => {
    expect(predictPasses(ISS, at(1), 48, PARIS).length).toBeGreaterThan(0)
    expect(predictPasses(ISS, at(40), 48, PARIS)).toEqual([])
    const candidates = selectCandidates({ records: [ISS] })
    expect(predictVisiblePasses(candidates, at(40), PARIS)).toEqual([])
    expect(getGroundTrack(ISS, at(40), 90)).toEqual([])
  })

  it('la trace au sol s’arrête exactement à la borne', () => {
    const track = getGroundTrack(ISS, at(29.99), 60, 60)
    expect(track.length).toBeGreaterThan(0)
    expect(track.every((p) => isTleValidAt(ISS, p.time))).toBe(true)
    expect(track.length).toBeLessThan(61)
  })

  it('carte du ciel : satellite signalé indisponible, astres jamais concernés', () => {
    const ref = satelliteRef(25544)!
    expect(isSatelliteUnavailable(ref, at(1))).toBe(false)
    expect(isSatelliteUnavailable(ref, at(60))).toBe(true)
    const m = eqjToEnuMatrix(at(1), PARIS)
    expect(objectDirection(ref, at(1), PARIS, m)).toHaveLength(3)
    expect(isSatelliteUnavailable({ ...ref, noradId: null }, at(60))).toBe(false)
  })
})
