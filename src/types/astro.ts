/**
 * Types du moteur d'éphémérides (src/services/astro/).
 * Les instants sont des `Date` UTC ; les angles portent leur unité en suffixe.
 */

export type SolarSystemBodyId =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'

export interface ObserverLocation {
  readonly latitudeDeg: number
  readonly longitudeDeg: number
  /** Altitude au-dessus du géoïde, en mètres. */
  readonly elevationM: number
}

export interface HorizontalPosition {
  /** Azimut compté depuis le nord vers l'est, en degrés [0, 360). */
  readonly azimuthDeg: number
  /** Hauteur au-dessus de l'horizon (réfraction incluse), en degrés. */
  readonly altitudeDeg: number
}

export interface BodyEphemeris extends HorizontalPosition {
  readonly id: SolarSystemBodyId
  readonly nameFr: string
  /** Ascension droite apparente de la date, en heures [0, 24). */
  readonly raHours: number
  /** Déclinaison apparente de la date, en degrés. */
  readonly decDeg: number
  /** Distance topocentrique, en unités astronomiques. */
  readonly distanceAu: number
  /** Magnitude visuelle apparente. */
  readonly magnitude: number
  /** Fraction illuminée du disque [0, 1]. */
  readonly illuminatedFraction: number
  /** Élongation angulaire au Soleil, en degrés (0 pour le Soleil). */
  readonly elongationDeg: number
  /** Diamètre apparent, en secondes d'arc. */
  readonly angularDiameterArcsec: number
  readonly constellation: string
}

export interface RiseTransitSet {
  readonly rise: Date | null
  readonly transit: Date | null
  readonly set: Date | null
  /** Hauteur au passage au méridien, en degrés. */
  readonly transitAltitudeDeg: number | null
  /** Astre visible toute la période (circumpolaire). */
  readonly alwaysUp: boolean
  /** Astre jamais levé sur la période. */
  readonly alwaysDown: boolean
}

export interface TwilightTimes {
  readonly sunset: Date | null
  readonly civilDusk: Date | null
  readonly nauticalDusk: Date | null
  readonly astronomicalDusk: Date | null
  readonly astronomicalDawn: Date | null
  readonly nauticalDawn: Date | null
  readonly civilDawn: Date | null
  readonly sunrise: Date | null
  /** Durée de nuit astronomique (Soleil < −18°), en minutes. */
  readonly astronomicalNightMinutes: number
}

export type MoonPhaseName =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'third-quarter'
  | 'waning-crescent'

export interface MoonPhaseEvent {
  /** 0 = nouvelle lune, 1 = premier quartier, 2 = pleine lune, 3 = dernier quartier. */
  readonly quarter: 0 | 1 | 2 | 3
  readonly time: Date
}

export interface MoonInfo {
  /** Longitude écliptique Lune − Soleil, en degrés [0, 360). */
  readonly phaseAngleDeg: number
  readonly phaseName: MoonPhaseName
  readonly phaseNameFr: string
  /** Fraction illuminée [0, 1]. */
  readonly illuminatedFraction: number
  /** Âge depuis la dernière nouvelle lune, en jours. */
  readonly ageDays: number
  readonly distanceKm: number
  readonly nextQuarters: readonly MoonPhaseEvent[]
}

export interface AltitudeSample {
  readonly time: Date
  readonly altitudeDeg: number
  readonly azimuthDeg: number
}

export type AstroEventKind =
  | 'moon-phase'
  | 'lunar-eclipse'
  | 'solar-eclipse'
  | 'max-elongation'
  | 'opposition'
  | 'conjunction'
  | 'peak-magnitude'
  | 'season'
  | 'meteor-shower'
  | 'lunar-apsis'

export interface AstroEvent {
  readonly kind: AstroEventKind
  readonly time: Date
  readonly title: string
  readonly detail: string
  readonly bodies: readonly SolarSystemBodyId[]
}

/** Cible quelconque pour laquelle on peut tracer une courbe de hauteur. */
export type SkyTarget =
  | { readonly kind: 'body'; readonly id: SolarSystemBodyId }
  | { readonly kind: 'fixed'; readonly raDeg: number; readonly decDeg: number; readonly label: string }

export interface DeepSkyVisibility {
  readonly id: string
  readonly maxAltitudeDeg: number
  /** Instant de hauteur maximale pendant la nuit astronomique (ou la nuit civile). */
  readonly bestTime: Date | null
  /** Minutes passées au-dessus de 30° pendant la nuit noire. */
  readonly minutesAbove30Deg: number
  readonly current: HorizontalPosition
}

export interface ActiveMeteorShower {
  readonly code: string
  readonly name: string
  readonly peak: Date
  /** Écart au maximum en jours (négatif = avant). */
  readonly daysFromPeak: number
  readonly radiantAltitudeDeg: number
  /** Taux horaire réellement observable estimé (hauteur du radiant, Lune, limite visuelle). */
  readonly expectedHourlyRate: number
  readonly zhr: number
}
