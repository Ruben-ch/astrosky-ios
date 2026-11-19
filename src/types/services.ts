/** Types partagés des services de localisation, satellites, météo et simulation. */
import type { ObserverLocation } from './astro'

// ─── Localisation ──────────────────────────────────────────────────────
export type LocationSource = 'gps' | 'cache' | 'manual' | 'default'

export interface ResolvedLocation extends ObserverLocation {
  readonly source: LocationSource
  /** Précision horizontale en mètres (`null` hors GPS). */
  readonly accuracyM: number | null
  /** Horodatage Unix (ms) de l'acquisition. */
  readonly acquiredAt: number
  readonly label: string
}

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

// ─── Satellites ────────────────────────────────────────────────────────
export interface TleRecord {
  readonly name: string
  readonly noradId: number
  readonly line1: string
  readonly line2: string
}

export interface TleSet {
  readonly records: readonly TleRecord[]
  /** Horodatage Unix (ms) du téléchargement des éléments. */
  readonly fetchedAt: number
  /** `network` = frais, `cache` = cache valide, `stale-cache`/`bundled` = hors-ligne. */
  readonly origin: 'network' | 'cache' | 'stale-cache' | 'bundled'
}

export interface SatelliteState {
  readonly noradId: number
  readonly name: string
  readonly time: Date
  readonly azimuthDeg: number
  readonly elevationDeg: number
  readonly rangeKm: number
  readonly latitudeDeg: number
  readonly longitudeDeg: number
  readonly altitudeKm: number
  readonly speedKmS: number
  /** Fraction de disque solaire masquée par la Terre (0 éclairé, 1 ombre). */
  readonly shadowFraction: number
  /** Éclairé par le Soleil ET observateur dans la nuit (Soleil < −6°) ET au-dessus de l'horizon. */
  readonly visible: boolean
}

export interface SatellitePassPoint {
  readonly time: Date
  readonly azimuthDeg: number
  readonly elevationDeg: number
}

export interface SatellitePass {
  readonly noradId: number
  readonly name: string
  readonly rise: SatellitePassPoint
  readonly culmination: SatellitePassPoint
  readonly set: SatellitePassPoint
  readonly durationSec: number
  /** Le passage comporte au moins une portion éclairée visible à l'œil nu. */
  readonly visible: boolean
  /** Portion visible (éclairé + ciel sombre), `null` si invisible. */
  readonly visibleFrom: Date | null
  readonly visibleTo: Date | null
}

// ─── Météo ─────────────────────────────────────────────────────────────
export interface WeatherHour {
  readonly time: Date
  readonly cloudCoverPct: number
  readonly cloudLowPct: number
  readonly cloudMidPct: number
  readonly cloudHighPct: number
  readonly humidityPct: number
  readonly temperatureC: number
  readonly dewPointC: number
  readonly windSpeedKmh: number
  readonly windGustKmh: number
  /** Vent au niveau 250 hPa (jet-stream), en km/h. */
  readonly jetStreamKmh: number
  readonly visibilityM: number
  readonly precipitationProbabilityPct: number
}

export interface ForecastSet {
  readonly hours: readonly WeatherHour[]
  readonly fetchedAt: number
  readonly origin: 'network' | 'cache' | 'stale-cache'
}

export type SeeingLabel = 'excellent' | 'bon' | 'moyen' | 'médiocre' | 'mauvais'

export interface ObservingScore {
  readonly time: Date
  /** Score global d'observation 0–100. */
  readonly overall: number
  /** Ciel dégagé 0–100 (pondération basse/moyenne/haute couche). */
  readonly clearSky: number
  /** Transparence 0–100 (humidité, visibilité, cirrus). */
  readonly transparency: number
  /** Seeing (turbulence) 0–100 (jet-stream, vent, gradient thermique). */
  readonly seeing: number
  /** Seeing équivalent sur l'échelle de Pickering 1–10. */
  readonly pickering: number
  readonly seeingLabel: SeeingLabel
  /** Pénalité due à la Lune 0–100 (0 = sans gêne). */
  readonly moonPenalty: number
  /** Risque de buée sur l'optique (écart T − Td < 2,5 °C). */
  readonly dewRisk: boolean
}

// ─── Simulation ────────────────────────────────────────────────────────
export interface ClockAnchor {
  /** Horodatage réel (ms, `Date.now()`) au moment de l'ancrage. */
  readonly realMs: number
  /** Horodatage simulé (ms) au moment de l'ancrage. */
  readonly simMs: number
  /** Facteur d'accélération (1 = temps réel, 0 = pause, négatif = rembobinage). */
  readonly rate: number
}
