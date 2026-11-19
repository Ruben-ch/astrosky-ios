/**
 * Types du simulateur d'oculaire et de cadrage astrophotographique.
 * Longueurs en millimètres (suffixe `Mm`), champs en degrés (`Deg`) ou minutes d'arc (`Arcmin`).
 */

export type TelescopeKind = 'refractor' | 'newtonian' | 'sct' | 'maksutov' | 'custom'

export interface TelescopeSpec {
  readonly kind: TelescopeKind
  /** Diamètre de l'objectif / du miroir primaire, en mm. */
  readonly apertureMm: number
  /** Focale résultante, en mm. */
  readonly focalLengthMm: number
}

export interface TelescopePreset extends TelescopeSpec {
  readonly id: string
  readonly labelFr: string
}

export interface EyepieceSpec {
  readonly focalLengthMm: number
  /** Champ apparent, en degrés. */
  readonly apparentFieldDeg: number
}

export type BarlowFactor = 1 | 2 | 3

export interface SensorSpec {
  readonly widthMm: number
  readonly heightMm: number
}

export interface SensorPreset extends SensorSpec {
  readonly id: string
  readonly labelFr: string
}

export type FovMode = 'visual' | 'photo'

/**
 * Orientation de l'image : nord en haut / est à gauche (ciel à l'œil),
 * renversée de 180° (Newton, lunette sans renvoi) ou en miroir (renvoi coudé).
 */
export type ImageOrientation = 'sky' | 'inverted' | 'mirrored'

export interface FovSettings {
  readonly mode: FovMode
  /** Identifiant de preset, ou `"custom"` pour un instrument personnalisé. */
  readonly telescopeId: string
  readonly telescope: TelescopeSpec
  readonly eyepiece: EyepieceSpec
  readonly barlow: BarlowFactor
  readonly sensorId: string
  readonly sensor: SensorSpec
  /** Rotation du capteur (angle du grand côté, du nord vers l'est), en degrés [0, 180). */
  readonly sensorRotationDeg: number
  readonly orientation: ImageOrientation
}

export interface VisualFov {
  readonly effectiveFocalMm: number
  readonly magnification: number
  readonly exitPupilMm: number
  readonly trueFieldDeg: number
  readonly focalRatio: number
  /** Grossissement maximal utile (2 × D en mm). */
  readonly maxUsefulMagnification: number
  /** Grossissement équipupillaire (pupille de sortie de 7 mm). */
  readonly minUsefulMagnification: number
  readonly warnings: readonly FovWarning[]
}

export type FovWarning = 'exit-pupil-too-large' | 'over-magnified' | 'exit-pupil-tiny'

export interface PhotoFov {
  readonly widthDeg: number
  readonly heightDeg: number
  readonly diagonalDeg: number
  readonly focalRatio: number
  /** Échelle au plan focal, en secondes d'arc par millimètre. */
  readonly arcsecPerMm: number
}

/** Remplissage du cadre par l'objet : grand axe / plus petit côté du champ. */
export interface FramingFit {
  readonly ratio: number
  readonly verdict: 'tiny' | 'small' | 'good' | 'tight' | 'overflow'
}
