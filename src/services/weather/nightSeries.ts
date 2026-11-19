/**
 * Séries horaires de la nuit pour les graphiques de l'onglet « Ce soir » :
 * couverture nuageuse par couche, transparence, seeing et risque de rosée.
 * S'appuie sur les scores de `weatherService` (Open-Meteo).
 */
import type { WeatherHour } from '../../types/services'
import type { DewRiskLevel, WeatherPoint } from '../../types/tonight'
import { scoreHour, type MoonCondition } from '../weatherService'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Risque de rosée 0–100 (modèle empirique de l'astronome amateur) :
 * - l'écart T − Td est le facteur principal (0 °C → saturation, ≥ 5 °C → nul) ;
 * - l'humidité relative au-delà de 70 % renforce le risque ;
 * - le vent brasse la couche de surface et limite le refroidissement radiatif
 *   des optiques : au-delà de ~20 km/h le risque est réduit de 40 %.
 */
export function dewRiskScore(h: Pick<WeatherHour, 'temperatureC' | 'dewPointC' | 'humidityPct' | 'windSpeedKmh'>): number {
  const spread = h.temperatureC - h.dewPointC
  const base = clamp01((5 - spread) / 5)
  const humidity = 0.6 + 0.4 * clamp01((h.humidityPct - 70) / 25)
  const wind = 1 - 0.4 * clamp01((h.windSpeedKmh - 5) / 15)
  return Math.round(100 * base * humidity * wind)
}

export function dewLevel(risk: number): DewRiskLevel {
  if (risk >= 70) return 'high'
  if (risk >= 45) return 'moderate'
  if (risk >= 20) return 'low'
  return 'none'
}

export const DEW_LEVEL_FR: Readonly<Record<DewRiskLevel, string>> = {
  none: 'Nul',
  low: 'Faible',
  moderate: 'Modéré',
  high: 'Élevé',
}

/** Point horaire complet pour une heure de prévision. */
export function toWeatherPoint(h: WeatherHour, moon: MoonCondition | null = null): WeatherPoint {
  const s = scoreHour(h, moon)
  const dewRisk = dewRiskScore(h)
  return {
    time: h.time,
    cloudCoverPct: Math.round(h.cloudCoverPct),
    cloudLowPct: Math.round(h.cloudLowPct),
    cloudMidPct: Math.round(h.cloudMidPct),
    cloudHighPct: Math.round(h.cloudHighPct),
    transparency: s.transparency,
    seeing: s.seeing,
    pickering: s.pickering,
    seeingLabel: s.seeingLabel,
    temperatureC: h.temperatureC,
    dewPointC: h.dewPointC,
    dewSpreadC: Math.round((h.temperatureC - h.dewPointC) * 10) / 10,
    dewRisk,
    dewLevel: dewLevel(dewRisk),
    windSpeedKmh: h.windSpeedKmh,
    overall: s.overall,
  }
}

/** Heures de prévision dans [start, end] converties en points de graphique. */
export function buildNightSeries(
  hours: readonly WeatherHour[],
  start: Date,
  end: Date,
  moonAt?: (time: Date) => MoonCondition,
): WeatherPoint[] {
  return hours
    .filter((h) => h.time >= start && h.time <= end)
    .map((h) => toWeatherPoint(h, moonAt ? moonAt(h.time) : null))
}

/** Fenêtre d'affichage météo : du coucher − 1 h au lever + 1 h, arrondie à l'heure. */
export function weatherWindow(sunset: Date | null, sunrise: Date | null, fallbackStart: Date, fallbackEnd: Date): { start: Date; end: Date } {
  const HOUR = 3_600_000
  const s = sunset ? sunset.getTime() - HOUR : fallbackStart.getTime()
  const e = sunrise ? sunrise.getTime() + HOUR : fallbackEnd.getTime()
  return { start: new Date(Math.floor(s / HOUR) * HOUR), end: new Date(Math.ceil(e / HOUR) * HOUR) }
}

/** Point le plus proche de `time` (à 90 min près), ou `null`. */
export function pointNear(points: readonly WeatherPoint[], time: Date): WeatherPoint | null {
  let best: WeatherPoint | null = null
  let bestDt = 90 * 60_000
  for (const p of points) {
    const dt = Math.abs(p.time.getTime() - time.getTime())
    if (dt <= bestDt) {
      best = p
      bestDt = dt
    }
  }
  return best
}
