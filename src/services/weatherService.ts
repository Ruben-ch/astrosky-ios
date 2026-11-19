/**
 * Prévisions météo astronomiques (Open-Meteo, sans clé d'API) et score
 * d'observation : ciel dégagé, transparence, seeing (turbulence) et gêne lunaire.
 * Cache 1 h par cellule de 0,1°, repli sur le cache périmé hors-ligne.
 */
import type { ObserverLocation } from '../types/astro'
import type { ForecastSet, ObservingScore, SeeingLabel, WeatherHour } from '../types/services'
import { cachedFetch } from './cache'

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
export const WEATHER_TTL_MS = 3_600_000
const FETCH_TIMEOUT_MS = 10_000

export const HOURLY_VARIABLES = [
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'relative_humidity_2m',
  'temperature_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_gusts_10m', 'wind_speed_250hPa',
  'visibility', 'precipitation_probability',
] as const

type HourlyVariable = (typeof HOURLY_VARIABLES)[number]

export interface OpenMeteoResponse {
  hourly: { time: (string | number)[] } & Partial<Record<HourlyVariable, (number | null)[]>>
}

export class WeatherUnavailableError extends Error {}

export function buildForecastUrl(loc: ObserverLocation, days = 3): string {
  const params = new URLSearchParams({
    latitude: loc.latitudeDeg.toFixed(2),
    longitude: loc.longitudeDeg.toFixed(2),
    hourly: HOURLY_VARIABLES.join(','),
    forecast_days: String(days),
    timezone: 'UTC',
    timeformat: 'unixtime',
  })
  return `${OPEN_METEO_URL}?${params.toString()}`
}

/** Clé de cache par cellule de 0,1° (≈ 11 km) : la météo n'est pas plus fine. */
export function forecastCacheKey(loc: ObserverLocation): string {
  return `weather:${loc.latitudeDeg.toFixed(1)}:${loc.longitudeDeg.toFixed(1)}`
}

/** Convertit la réponse horaire Open-Meteo en tableau typé (valeurs manquantes neutralisées). */
export function parseOpenMeteo(json: OpenMeteoResponse): WeatherHour[] {
  const h = json.hourly
  if (!h || !Array.isArray(h.time)) throw new WeatherUnavailableError('Réponse Open-Meteo invalide')
  const v = (name: HourlyVariable, i: number, fallback: number) => {
    const x = h[name]?.[i]
    return typeof x === 'number' && Number.isFinite(x) ? x : fallback
  }
  return h.time.map((t, i) => {
    const temperatureC = v('temperature_2m', i, 10)
    return {
      time: new Date(typeof t === 'number' ? t * 1000 : `${t}Z`),
      cloudCoverPct: v('cloud_cover', i, 100),
      cloudLowPct: v('cloud_cover_low', i, 0),
      cloudMidPct: v('cloud_cover_mid', i, 0),
      cloudHighPct: v('cloud_cover_high', i, 0),
      humidityPct: v('relative_humidity_2m', i, 80),
      temperatureC,
      dewPointC: v('dew_point_2m', i, temperatureC - 5),
      windSpeedKmh: v('wind_speed_10m', i, 0),
      windGustKmh: v('wind_gusts_10m', i, 0),
      jetStreamKmh: v('wind_speed_250hPa', i, 100),
      visibilityM: v('visibility', i, 20_000),
      precipitationProbabilityPct: v('precipitation_probability', i, 0),
    }
  })
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<OpenMeteoResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) throw new WeatherUnavailableError(`Open-Meteo HTTP ${res.status}`)
    return (await res.json()) as OpenMeteoResponse
  } finally {
    clearTimeout(timer)
  }
}

/** Prévisions horaires sur 3 jours. Lève `WeatherUnavailableError` si aucune donnée n'existe. */
export async function loadForecast(
  loc: ObserverLocation,
  options: { force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ForecastSet> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  try {
    const res = await cachedFetch(forecastCacheKey(loc), WEATHER_TTL_MS, () => fetchJson(buildForecastUrl(loc), fetchImpl), {
      force: options.force,
    })
    return { hours: parseOpenMeteo(res.value), fetchedAt: res.storedAt, origin: res.origin }
  } catch (error) {
    if (error instanceof WeatherUnavailableError) throw error
    throw new WeatherUnavailableError('Météo indisponible hors-ligne (aucune donnée en cache)')
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Ciel dégagé : combinaison probabiliste des couches (les nuages bas masquent tout, les cirrus en partie). */
export function clearSkyScore(h: Pick<WeatherHour, 'cloudLowPct' | 'cloudMidPct' | 'cloudHighPct'>): number {
  const low = h.cloudLowPct / 100
  const mid = h.cloudMidPct / 100
  const high = h.cloudHighPct / 100
  return 100 * (1 - low) * (1 - 0.85 * mid) * (1 - 0.5 * high)
}

/** Transparence : humidité (aérosols hygroscopiques), visibilité horizontale, voile de cirrus. */
export function transparencyScore(h: Pick<WeatherHour, 'humidityPct' | 'visibilityM' | 'cloudHighPct'>): number {
  const humidity = clamp01((100 - h.humidityPct) / 50)
  const visibility = clamp01(h.visibilityM / 30_000)
  const cirrus = 1 - h.cloudHighPct / 100
  return 100 * (0.5 * humidity + 0.3 * visibility + 0.2 * cirrus)
}

/**
 * Seeing : la turbulence d'altitude (jet-stream à 250 hPa) domine ; le vent de
 * surface et les rafales (cisaillement) dégradent la couche limite.
 */
export function seeingScore(h: Pick<WeatherHour, 'jetStreamKmh' | 'windSpeedKmh' | 'windGustKmh'>): number {
  const jet = clamp01((180 - h.jetStreamKmh) / 140)
  const wind = clamp01((40 - h.windSpeedKmh) / 35)
  const gust = clamp01(1 - (h.windGustKmh - h.windSpeedKmh) / 30)
  return 100 * (0.6 * jet + 0.25 * wind + 0.15 * gust)
}

export function seeingLabel(score: number): SeeingLabel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'bon'
  if (score >= 40) return 'moyen'
  if (score >= 20) return 'médiocre'
  return 'mauvais'
}

/** Pénalité lunaire 0–100 selon la fraction illuminée et la hauteur de la Lune. */
export function moonPenaltyScore(moonIlluminated: number, moonAltitudeDeg: number): number {
  if (moonAltitudeDeg <= 0) return 0
  return 100 * clamp01(moonIlluminated) * Math.sqrt(Math.sin((Math.min(moonAltitudeDeg, 90) * Math.PI) / 180))
}

export interface MoonCondition {
  readonly illuminated: number
  readonly altitudeDeg: number
}

/** Score d'observation complet pour une heure de prévision. */
export function scoreHour(h: WeatherHour, moon: MoonCondition | null = null): ObservingScore {
  const clearSky = clearSkyScore(h)
  const transparency = transparencyScore(h)
  const seeing = seeingScore(h)
  const moonPenalty = moon ? moonPenaltyScore(moon.illuminated, moon.altitudeDeg) : 0
  const quality = 0.45 + 0.3 * (transparency / 100) + 0.25 * (seeing / 100)
  const precip = 1 - 0.8 * (h.precipitationProbabilityPct / 100)
  const overall = clearSky * quality * (1 - 0.5 * (moonPenalty / 100)) * precip
  return {
    time: h.time,
    overall: Math.round(overall),
    clearSky: Math.round(clearSky),
    transparency: Math.round(transparency),
    seeing: Math.round(seeing),
    pickering: Math.round((1 + (9 * seeing) / 100) * 10) / 10,
    seeingLabel: seeingLabel(seeing),
    moonPenalty: Math.round(moonPenalty),
    dewRisk: h.temperatureC - h.dewPointC < 2.5,
  }
}

/** Scores horaires, avec conditions lunaires optionnelles fournies par le moteur d'éphémérides. */
export function scoreForecast(hours: readonly WeatherHour[], moonAt?: (time: Date) => MoonCondition): ObservingScore[] {
  return hours.map((h) => scoreHour(h, moonAt ? moonAt(h.time) : null))
}

/** Meilleure heure d'observation dans la fenêtre [start, end], ou `null`. */
export function bestObservingHour(scores: readonly ObservingScore[], start: Date, end: Date): ObservingScore | null {
  let best: ObservingScore | null = null
  for (const s of scores) {
    if (s.time < start || s.time > end) continue
    if (!best || s.overall > best.overall) best = s
  }
  return best
}

/** Score de la nuit : moyenne des heures de la fenêtre sombre. */
export function nightAverageScore(scores: readonly ObservingScore[], start: Date, end: Date): number | null {
  const inWindow = scores.filter((s) => s.time >= start && s.time <= end)
  if (inWindow.length === 0) return null
  return Math.round(inWindow.reduce((sum, s) => sum + s.overall, 0) / inWindow.length)
}
