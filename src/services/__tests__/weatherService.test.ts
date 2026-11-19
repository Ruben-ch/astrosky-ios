import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setCacheStorage } from '../cache'
import {
  WeatherUnavailableError,
  bestObservingHour,
  buildForecastUrl,
  clearSkyScore,
  forecastCacheKey,
  loadForecast,
  moonPenaltyScore,
  nightAverageScore,
  parseOpenMeteo,
  scoreForecast,
  scoreHour,
  seeingLabel,
  seeingScore,
  transparencyScore,
  type OpenMeteoResponse,
} from '../weatherService'
import type { WeatherHour } from '../../types/services'
import { createMemoryStorage } from './memoryStorage'

const LOC = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const T = 1_795_000_000 // secondes Unix

const sample: OpenMeteoResponse = {
  hourly: {
    time: [T, T + 3600, T + 7200],
    cloud_cover: [0, 50, 100],
    cloud_cover_low: [0, 10, 100],
    cloud_cover_mid: [0, 30, 50],
    cloud_cover_high: [0, 40, 20],
    relative_humidity_2m: [45, 80, 98],
    temperature_2m: [8, 6, 5],
    dew_point_2m: [-2, 3, 4.8],
    wind_speed_10m: [5, 15, 30],
    wind_gusts_10m: [8, 30, 60],
    wind_speed_250hPa: [30, 120, 200],
    visibility: [40_000, 15_000, 2_000],
    precipitation_probability: [0, 20, 90],
  },
}

const clearHour: WeatherHour = parseOpenMeteo(sample)[0]
const jsonResponse = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response

describe('analyse Open-Meteo', () => {
  it('construit l’URL avec toutes les variables', () => {
    const url = buildForecastUrl(LOC)
    expect(url).toContain('latitude=48.86')
    expect(url).toContain('wind_speed_250hPa')
    expect(url).toContain('timeformat=unixtime')
    expect(forecastCacheKey(LOC)).toBe('weather:48.9:2.4')
  })

  it('convertit les heures et neutralise les valeurs manquantes', () => {
    const hours = parseOpenMeteo(sample)
    expect(hours).toHaveLength(3)
    expect(hours[0].time.getTime()).toBe(T * 1000)
    expect(hours[2].jetStreamKmh).toBe(200)
    const sparse = parseOpenMeteo({ hourly: { time: ['2026-11-18T20:00'], cloud_cover: [null] } })
    expect(sparse[0].time.toISOString()).toBe('2026-11-18T20:00:00.000Z')
    expect(sparse[0].cloudCoverPct).toBe(100)
    expect(() => parseOpenMeteo({} as OpenMeteoResponse)).toThrow(WeatherUnavailableError)
  })
})

describe('scores d’observation', () => {
  it('composantes bornées et monotones', () => {
    expect(clearSkyScore({ cloudLowPct: 0, cloudMidPct: 0, cloudHighPct: 0 })).toBe(100)
    expect(clearSkyScore({ cloudLowPct: 100, cloudMidPct: 0, cloudHighPct: 0 })).toBe(0)
    expect(clearSkyScore({ cloudLowPct: 0, cloudMidPct: 0, cloudHighPct: 100 })).toBe(50)
    expect(transparencyScore({ humidityPct: 40, visibilityM: 50_000, cloudHighPct: 0 })).toBe(100)
    expect(seeingScore({ jetStreamKmh: 20, windSpeedKmh: 0, windGustKmh: 0 })).toBe(100)
    expect(seeingScore({ jetStreamKmh: 250, windSpeedKmh: 60, windGustKmh: 120 })).toBe(0)
    expect(seeingScore({ jetStreamKmh: 60, windSpeedKmh: 5, windGustKmh: 8 }))
      .toBeGreaterThan(seeingScore({ jetStreamKmh: 150, windSpeedKmh: 5, windGustKmh: 8 }))
  })

  it('libellés de seeing', () => {
    expect(seeingLabel(90)).toBe('excellent')
    expect(seeingLabel(65)).toBe('bon')
    expect(seeingLabel(45)).toBe('moyen')
    expect(seeingLabel(25)).toBe('médiocre')
    expect(seeingLabel(5)).toBe('mauvais')
  })

  it('pénalité lunaire', () => {
    expect(moonPenaltyScore(1, -5)).toBe(0)
    expect(moonPenaltyScore(1, 90)).toBe(100)
    expect(moonPenaltyScore(0.5, 30)).toBeCloseTo(50 * Math.sqrt(0.5), 6)
  })

  it('score global : nuit claire ≫ nuit couverte, la Lune pénalise', () => {
    const scores = scoreForecast(parseOpenMeteo(sample))
    expect(scores[0].overall).toBeGreaterThan(90)
    expect(scores[2].overall).toBe(0)
    expect(scores[0].pickering).toBeGreaterThan(9)
    expect(scores[2].dewRisk).toBe(true)
    expect(scores[0].dewRisk).toBe(false)
    const withMoon = scoreHour(clearHour, { illuminated: 1, altitudeDeg: 60 })
    expect(withMoon.overall).toBeLessThan(scores[0].overall)
    expect(withMoon.moonPenalty).toBeGreaterThan(80)
  })

  it('meilleure heure et moyenne de nuit', () => {
    const scores = scoreForecast(parseOpenMeteo(sample), () => ({ illuminated: 0, altitudeDeg: -10 }))
    const start = new Date(T * 1000)
    const end = new Date((T + 7200) * 1000)
    expect(bestObservingHour(scores, start, end)?.time.getTime()).toBe(T * 1000)
    expect(nightAverageScore(scores, start, end)).toBe(Math.round((scores[0].overall + scores[1].overall) / 3))
    expect(bestObservingHour(scores, new Date(0), new Date(1))).toBeNull()
    expect(nightAverageScore(scores, new Date(0), new Date(1))).toBeNull()
  })
})

describe('chargement des prévisions', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('réseau puis cache', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sample))
    expect((await loadForecast(LOC, { fetchImpl })).origin).toBe('network')
    const cached = await loadForecast(LOC, { fetchImpl })
    expect(cached.origin).toBe('cache')
    expect(cached.hours[0].time).toBeInstanceOf(Date)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('cache périmé hors-ligne, erreur explicite sans donnée', async () => {
    await loadForecast(LOC, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse(sample)) })
    const offline = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await loadForecast(LOC, { fetchImpl: offline, force: true })).origin).toBe('stale-cache')
    setCacheStorage(createMemoryStorage())
    await expect(loadForecast(LOC, { fetchImpl: offline })).rejects.toBeInstanceOf(WeatherUnavailableError)
    await expect(loadForecast(LOC, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse({}, false)) }))
      .rejects.toBeInstanceOf(WeatherUnavailableError)
  })
})
