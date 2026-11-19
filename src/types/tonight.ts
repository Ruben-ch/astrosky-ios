/**
 * Types de l'onglet « Ce soir » : frise des crépuscules, séries météo horaires,
 * détail lunaire et classement des cibles par instrument.
 * Instants en `Date` UTC ; angles suffixés `Deg`.
 */
import type { SolarSystemBodyId } from './astro'
import type { DeepSkyType } from './catalog'
import type { SeeingLabel } from './services'

// ─── Frise des crépuscules ─────────────────────────────────────────────
/** Phase lumineuse selon la hauteur du centre du Soleil. */
export type TwilightPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night'

export interface TwilightSegment {
  readonly phase: TwilightPhase
  readonly start: Date
  readonly end: Date
}

/** Transition franchie sur la frise (coucher, fin du crépuscule civil…). */
export interface TwilightTransition {
  readonly time: Date
  /** Phase qui commence à cet instant. */
  readonly phase: TwilightPhase
  readonly label: string
  /** `true` le soir (le Soleil descend), `false` le matin. */
  readonly evening: boolean
}

export interface Interval {
  readonly start: Date
  readonly end: Date
}

export interface NightTimeline {
  /** Midi solaire vrai local ouvrant la nuit d'observation. */
  readonly start: Date
  /** Midi solaire vrai suivant (≈ start + 24 h). */
  readonly end: Date
  readonly segments: readonly TwilightSegment[]
  readonly transitions: readonly TwilightTransition[]
  /** Intervalles où la Lune est au-dessus de l'horizon. */
  readonly moonUp: readonly Interval[]
  /** Nuit astronomique (Soleil < −18°) ET Lune couchée. */
  readonly moonlessDark: readonly Interval[]
  readonly moonlessDarkMinutes: number
}

// ─── Météo horaire ─────────────────────────────────────────────────────
export type DewRiskLevel = 'none' | 'low' | 'moderate' | 'high'

export interface WeatherPoint {
  readonly time: Date
  readonly cloudCoverPct: number
  readonly cloudLowPct: number
  readonly cloudMidPct: number
  readonly cloudHighPct: number
  /** Transparence 0–100. */
  readonly transparency: number
  /** Seeing 0–100 et équivalent Pickering 1–10. */
  readonly seeing: number
  readonly pickering: number
  readonly seeingLabel: SeeingLabel
  readonly temperatureC: number
  readonly dewPointC: number
  /** Écart température − point de rosée, en °C. */
  readonly dewSpreadC: number
  /** Risque de rosée 0–100. */
  readonly dewRisk: number
  readonly dewLevel: DewRiskLevel
  readonly windSpeedKmh: number
  readonly overall: number
}

// ─── Lune ──────────────────────────────────────────────────────────────
export interface MoonDetail {
  readonly phaseAngleDeg: number
  readonly phaseNameFr: string
  readonly illuminatedFraction: number
  readonly ageDays: number
  /** Durée de la lunaison synodique courante, en jours. */
  readonly lunationDays: number
  readonly distanceKm: number
  readonly angularDiameterArcmin: number
  readonly altitudeDeg: number
  readonly azimuthDeg: number
  readonly constellation: string
  readonly rise: Date | null
  readonly set: Date | null
  readonly transit: Date | null
  readonly transitAltitudeDeg: number | null
  readonly previousNewMoon: Date
  readonly nextNewMoon: Date
  readonly nextFullMoon: Date
  /** Fraction illuminée échantillonnée chaque jour sur la lunaison courante. */
  readonly lunationCurve: readonly { readonly time: Date; readonly illuminatedFraction: number }[]
}

// ─── Cibles de la nuit ─────────────────────────────────────────────────
export type InstrumentId = 'naked-eye' | 'binoculars' | 'telescope'

export interface InstrumentProfile {
  readonly id: InstrumentId
  readonly labelFr: string
  /** Diamètre de pupille d'entrée, en mm (7 mm pour l'œil adapté). */
  readonly apertureMm: number
  /** Grossissement typique. */
  readonly magnification: number
  /** Champ réel typique, en degrés. */
  readonly fieldDeg: number
  /** Brillance de surface limite des objets étendus par ciel noir, en mag/arcsec². */
  readonly surfaceBrightnessLimit: number
}

export type TargetKind = 'deep-sky' | 'planet' | 'moon'

export interface RankedTarget {
  /** Clé de verrouillage dans le Catalogue (`"M31"`, `"NGC869"`, `"Jupiter"`). */
  readonly key: string
  readonly kind: TargetKind
  readonly code: string
  readonly name: string
  readonly typeLabel: string
  readonly deepSkyType: DeepSkyType | null
  readonly bodyId: SolarSystemBodyId | null
  readonly constellation: string
  readonly magnitude: number | null
  /** Score 0–100. */
  readonly score: number
  readonly maxAltitudeDeg: number
  readonly bestTime: Date | null
  /** Minutes au-dessus de 30° pendant la fenêtre sombre. */
  readonly minutesAbove30Deg: number
  /** Distance angulaire à la Lune, en degrés. */
  readonly moonSeparationDeg: number
  /** Arguments structurés (libellés résolus par l'UI). */
  readonly tags: readonly TargetTag[]
}

/**
 * - `high` : culmine au-dessus de 60° ;
 * - `long-window` : plus de 4 h au-dessus de 30° ;
 * - `moon-far` / `moon-near` : à plus de 60° / moins de 25° d'une Lune éclairée à plus de 30 % ;
 * - `bright` : nettement plus brillant que la limite de l'instrument ;
 * - `large` : plus grand que la moitié du champ de l'instrument ;
 * - `twilight` : planète observable surtout au crépuscule.
 */
export type TargetTag = 'high' | 'long-window' | 'moon-far' | 'moon-near' | 'bright' | 'large' | 'twilight'
