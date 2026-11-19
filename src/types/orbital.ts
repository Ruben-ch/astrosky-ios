/**
 * Types du radar orbital : magnitudes standard, trajectoires échantillonnées
 * et passages visibles prédits (SGP4 / satellite.js).
 * Instants en `Date` UTC ; angles suffixés `Deg`, distances en km.
 */
import type { TleRecord } from './services'

export type MagnitudeSource = 'quicksat' | 'heavens-above'

/** Magnitude standard d'un satellite : à 1000 km de distance, disque éclairé à 50 %. */
export interface BrightSatelliteMagnitude {
  readonly name: string
  readonly stdMag: number
  readonly source: MagnitudeSource
}

/** Point de trajectoire d'un passage. */
export interface PassTrackPoint {
  readonly time: Date
  readonly azimuthDeg: number
  readonly elevationDeg: number
  readonly rangeKm: number
  /** Fraction du disque solaire masquée par la Terre vue du satellite (0 éclairé, 1 ombre). */
  readonly shadowFraction: number
  /** Le satellite reçoit la lumière du Soleil (fraction d'ombre < 0,5). */
  readonly sunlit: boolean
  /** Magnitude apparente estimée, `null` si dans l'ombre ou magnitude standard inconnue. */
  readonly magnitude: number | null
  /** Éclairé, au-dessus de l'horizon et observateur dans la nuit (Soleil < −6°). */
  readonly visible: boolean
}

/** Évènement notable d'un passage, positionné sur la voûte. */
export interface PassEvent {
  readonly time: Date
  readonly azimuthDeg: number
  readonly elevationDeg: number
  readonly magnitude: number | null
}

export interface VisiblePass {
  /** Identifiant stable : `"<norad>-<lever ms>"`. */
  readonly id: string
  readonly noradId: number
  readonly name: string
  readonly stdMag: number | null
  readonly rise: PassEvent
  readonly culmination: PassEvent
  readonly set: PassEvent
  /** Entrée dans l'ombre de la Terre pendant le passage, `null` si aucune. */
  readonly shadowEntry: PassEvent | null
  /** Sortie de l'ombre de la Terre pendant le passage, `null` si aucune. */
  readonly shadowExit: PassEvent | null
  /** Début et fin de la portion visible à l'œil nu. */
  readonly visibleStart: PassEvent
  readonly visibleEnd: PassEvent
  /** Magnitude la plus brillante atteinte pendant la portion visible. */
  readonly peakMagnitude: number | null
  readonly durationSec: number
  readonly visibleDurationSec: number
  /** Trajectoire du lever au coucher (pas de 10 s). */
  readonly track: readonly PassTrackPoint[]
}

export interface PassPredictionOptions {
  /** Durée de prédiction, en heures. */
  readonly hours: number
  /** Culmination minimale retenue, en degrés. */
  readonly minCulminationDeg: number
  /** Magnitude maximale (plus faible) d'un passage retenu pour un satellite non suivi. */
  readonly magnitudeLimit: number
  /** Satellites toujours retenus dès qu'un passage est visible (ISS, Tiangong). */
  readonly alwaysInclude: readonly number[]
}

export interface PassPredictionProgress {
  readonly done: number
  readonly total: number
}

/** Satellite candidat : éléments orbitaux et magnitude standard connue. */
export interface OrbitalCandidate {
  readonly record: TleRecord
  readonly stdMag: number | null
}
