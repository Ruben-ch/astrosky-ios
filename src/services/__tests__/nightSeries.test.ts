import { describe, expect, it } from 'vitest'
import { buildNightSeries, dewLevel, dewRiskScore, pointNear, toWeatherPoint, weatherWindow } from '../weather/nightSeries'
import type { WeatherHour } from '../../types/services'

const H0 = Date.UTC(2026, 10, 18, 15)
const hour = (i: number, over: Partial<WeatherHour> = {}): WeatherHour => ({
  time: new Date(H0 + i * 3_600_000), cloudCoverPct: 20, cloudLowPct: 5, cloudMidPct: 10, cloudHighPct: 15,
  humidityPct: 70, temperatureC: 8, dewPointC: 2, windSpeedKmh: 8, windGustKmh: 14, jetStreamKmh: 60,
  visibilityM: 30_000, precipitationProbabilityPct: 0, ...over,
})

describe('risque de rosée', () => {
  it('croît quand l’écart T − Td diminue', () => {
    const risks = [6, 4, 2, 0.5, 0].map((spread) => dewRiskScore({ temperatureC: 5, dewPointC: 5 - spread, humidityPct: 95, windSpeedKmh: 2 }))
    expect(risks[0]).toBe(0)
    for (let i = 1; i < risks.length; i++) expect(risks[i]).toBeGreaterThan(risks[i - 1])
    expect(risks.at(-1)).toBe(100)
  })

  it('le vent et l’air sec réduisent le risque', () => {
    const calm = dewRiskScore({ temperatureC: 5, dewPointC: 4, humidityPct: 95, windSpeedKmh: 2 })
    expect(dewRiskScore({ temperatureC: 5, dewPointC: 4, humidityPct: 95, windSpeedKmh: 30 })).toBeLessThan(calm)
    expect(dewRiskScore({ temperatureC: 5, dewPointC: 4, humidityPct: 60, windSpeedKmh: 2 })).toBeLessThan(calm)
  })

  it('niveaux qualitatifs', () => {
    expect([0, 25, 50, 80].map(dewLevel)).toEqual(['none', 'low', 'moderate', 'high'])
  })
})

describe('séries horaires', () => {
  it('convertit une heure en point complet', () => {
    const p = toWeatherPoint(hour(0, { temperatureC: 3.04, dewPointC: 2.5 }))
    expect(p.dewSpreadC).toBe(0.5)
    expect(p.pickering).toBeGreaterThanOrEqual(1)
    expect(p.pickering).toBeLessThanOrEqual(10)
    expect(p.transparency).toBeGreaterThan(0)
    expect(p.dewLevel).not.toBe('none')
  })

  it('filtre la fenêtre et applique la Lune', () => {
    const hours = Array.from({ length: 24 }, (_, i) => hour(i))
    const start = new Date(H0 + 2 * 3_600_000)
    const end = new Date(H0 + 5 * 3_600_000)
    const noMoon = buildNightSeries(hours, start, end)
    const moon = buildNightSeries(hours, start, end, () => ({ illuminated: 1, altitudeDeg: 60 }))
    expect(noMoon).toHaveLength(4)
    expect(moon[0].overall).toBeLessThan(noMoon[0].overall)
  })

  it('fenêtre arrondie à l’heure autour du coucher et du lever', () => {
    const w = weatherWindow(new Date('2026-11-18T16:06:55Z'), new Date('2026-11-19T07:05:36Z'), new Date(0), new Date(0))
    expect(w.start.toISOString()).toBe('2026-11-18T15:00:00.000Z')
    expect(w.end.toISOString()).toBe('2026-11-19T09:00:00.000Z')
    const fb = weatherWindow(null, null, new Date('2026-06-21T11:20:00Z'), new Date('2026-06-22T11:20:00Z'))
    expect(fb.start.toISOString()).toBe('2026-06-21T11:00:00.000Z')
  })

  it('point le plus proche à 90 min près', () => {
    const pts = [0, 1, 2].map((i) => toWeatherPoint(hour(i)))
    expect(pointNear(pts, new Date(H0 + 80 * 60_000))?.time.getTime()).toBe(H0 + 3_600_000)
    expect(pointNear(pts, new Date(H0 + 10 * 3_600_000))).toBeNull()
  })
})
