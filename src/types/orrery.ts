/**
 * Types du Système Solaire 3D (onglet « Système »).
 *
 * Repères :
 * - **ECL** : écliptique moyen J2000 héliocentrique (x → point vernal, z → pôle nord
 *   de l'écliptique), en unités astronomiques. Obtenu depuis EQJ par `Rotation_EQJ_ECL`.
 * - **Scène** : repère Three.js (y vers le haut) : `scene = (x_ecl, z_ecl, −y_ecl)`,
 *   soit le plan de l'écliptique = plan XZ et le nord écliptique = +Y. Les distances
 *   y sont compressées (échelle visuelle lisible, cf. `services/orrery/visualScale`).
 */
import type { Vec3 } from './sky'

export type { Vec3 }

export type PlanetId = 'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune'

export type GalileanMoonId = 'Io' | 'Europa' | 'Ganymede' | 'Callisto'

export type OrreryBodyId = 'Sun' | PlanetId | GalileanMoonId

export type OrreryBodyKind = 'star' | 'planet' | 'moon'

/** Mode de vue de la caméra : rasante sur l'écliptique, ou depuis le pôle nord écliptique. */
export type OrreryViewMode = 'ecliptic' | 'polar'

/** État instantané d'un astre dans la scène. */
export interface OrreryBodyState {
  readonly id: OrreryBodyId
  /** Position héliocentrique écliptique J2000, en UA (non compressée). */
  readonly helioEclAu: Vec3
  /** Position dans la scène (unités de scène, distances compressées). */
  readonly scene: Vec3
  /** Vecteur unitaire du pôle nord de rotation IAU, dans le repère de scène. */
  readonly northScene: Vec3
  /** Angle du méridien origine W (IAU/WGCCRE 2015), en degrés. */
  readonly spinDeg: number
}

/** Positions de tous les astres de la scène à un instant donné. */
export interface OrrerySnapshot {
  readonly timeMs: number
  readonly bodies: Readonly<Record<OrreryBodyId, OrreryBodyState>>
}

/** Trajectoire échantillonnée (orbite planétaire héliocentrique ou orbite jovicentrique). */
export interface OrbitTrack {
  readonly id: PlanetId | GalileanMoonId
  /** Instant central de l'échantillonnage (ms Unix). */
  readonly epochMs: number
  /** Période échantillonnée, en jours. */
  readonly periodDays: number
  /**
   * Sommets (x, y, z) consécutifs, boucle fermée (dernier = premier).
   * Planètes : repère de scène héliocentrique. Lunes : décalages de scène jovicentriques.
   */
  readonly points: Float32Array
}

/** Visibilité vue de la Terre (cf. `ElongationEvent.visibility`). */
export type OrreryVisibility = 'morning' | 'evening' | null

/** Télémétrie détaillée d'un astre, vue depuis la Terre (géocentrique). */
export interface OrreryTelemetry {
  readonly id: OrreryBodyId
  readonly nameFr: string
  readonly kind: OrreryBodyKind
  /** Distance au Soleil, en UA (`null` pour le Soleil lui-même). */
  readonly sunDistanceAu: number | null
  /** Distance à la Terre, en UA (`null` pour la Terre elle-même). */
  readonly earthDistanceAu: number | null
  /** Magnitude visuelle apparente depuis la Terre (`null` si non modélisée). */
  readonly magnitude: number | null
  /** Diamètre apparent depuis la Terre, en secondes d'arc. */
  readonly angularDiameterArcsec: number | null
  /** Élongation au Soleil vue de la Terre, en degrés [0, 180]. */
  readonly elongationDeg: number | null
  readonly visibility: OrreryVisibility
  /** Fraction illuminée du disque [0, 1]. */
  readonly phaseFraction: number | null
  /** Angle de phase Soleil–astre–Terre, en degrés. */
  readonly phaseAngleDeg: number | null
  /** Obliquité vraie : axe de rotation vs normale à l’orbite propre (écliptique pour le Soleil), en degrés. */
  readonly axialTiltDeg: number | null
  /** Période orbitale sidérale moyenne, en jours. */
  readonly orbitalPeriodDays: number | null
  /** Temps de trajet de la lumière jusqu'à la Terre, en minutes. */
  readonly lightTimeMin: number | null
  /** Inclinaison des anneaux de Saturne vue de la Terre, en degrés. */
  readonly ringTiltDeg: number | null
  /** Lunes galiléennes : écart apparent à Jupiter vu de la Terre, en secondes d'arc. */
  readonly jupiterSeparationArcsec: number | null
}

/** Caméra orbitale sphérique autour d'un point visé. */
export interface OrbitCameraState {
  /** Point visé dans la scène. */
  readonly target: Vec3
  /** Distance caméra–cible, en unités de scène. */
  readonly distance: number
  /** Azimut autour de +Y (nord écliptique), radians. */
  readonly azimuthRad: number
  /** Élévation au-dessus du plan de l'écliptique, radians ]−π/2, π/2[. */
  readonly elevationRad: number
}

/** Préférences persistées de l'onglet. */
export interface OrrerySettings {
  readonly viewMode: OrreryViewMode
  readonly showOrbits: boolean
  readonly showLabels: boolean
  /** La caméra suit l'astre centré quand le temps avance. */
  readonly follow: boolean
}

/** Point projeté à l'écran pour la sélection au toucher. */
export interface ScreenPick {
  readonly id: OrreryBodyId
  /** Coordonnées CSS (px) dans le canevas. */
  readonly x: number
  readonly y: number
  /** Rayon apparent du disque, px CSS. */
  readonly radiusPx: number
  /** Profondeur (distance caméra), pour départager les astres superposés. */
  readonly depth: number
}
