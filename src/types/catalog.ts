/**
 * Types des catalogues célestes statiques (src/data/).
 * Toutes les coordonnées sont équatoriales J2000 (ICRS), en degrés.
 */

export type DeepSkyType =
  | 'galaxy'
  | 'globular-cluster'
  | 'open-cluster'
  | 'planetary-nebula'
  | 'emission-nebula'
  | 'reflection-nebula'
  | 'dark-nebula'
  | 'supernova-remnant'
  | 'cluster-nebula'
  | 'star-cloud'
  | 'double-star'
  | 'asterism'

/** Abréviation IAU officielle sur 3 lettres (ex. `"Ori"`, `"UMa"`). */
export type ConstellationAbbr = string

export interface DeepSkyObject {
  /** Identifiant unique compact : `"M31"`, `"NGC7000"`, `"IC434"`. */
  readonly id: string
  /** Numéro Messier, ou `null` hors catalogue Messier. */
  readonly messier: number | null
  /** Désignation NGC/IC avec espace (`"NGC 224"`), `null` si absente. */
  readonly ngc: string | null
  /** Nom usuel en français, `null` si l'objet n'a pas de nom consacré. */
  readonly name: string | null
  readonly type: DeepSkyType
  /** Ascension droite J2000 en degrés [0, 360). */
  readonly raDeg: number
  /** Déclinaison J2000 en degrés [-90, +90]. */
  readonly decDeg: number
  /** Magnitude visuelle intégrée, `null` si non mesurée (nébuleuses obscures). */
  readonly mag: number | null
  readonly sizeMajorArcmin: number | null
  readonly sizeMinorArcmin: number | null
  readonly constellation: ConstellationAbbr
}

export interface BrightStar {
  /** Numéro du catalogue Hipparcos. */
  readonly hip: number
  /** Nom propre (français si disponible), `null` sinon. */
  readonly name: string | null
  /** Désignation de Bayer/Flamsteed (`"α CMa"`) ou `"HIP n"`. */
  readonly designation: string
  readonly raDeg: number
  readonly decDeg: number
  /** Magnitude visuelle apparente V. */
  readonly mag: number
  /** Indice de couleur B−V (bleu < 0 < rouge), `null` si inconnu. */
  readonly bv: number | null
  readonly constellation: ConstellationAbbr
}

export interface ConstellationFigure {
  readonly id: ConstellationAbbr
  readonly nameFr: string
  readonly nameLatin: string
  /** Rang d'importance visuelle 1 (majeure) à 3 (discrète). */
  readonly rank: number
  /** Polylignes plates `[raDeg0, decDeg0, raDeg1, decDeg1, …]`. */
  readonly polylines: readonly (readonly number[])[]
}

export interface MeteorShower {
  /** Code IMO sur 3 lettres (ex. `"PER"`). */
  readonly code: string
  readonly name: string
  /** Début d'activité `[mois 1–12, jour]`. */
  readonly activeFrom: readonly [number, number]
  /** Fin d'activité `[mois 1–12, jour]` (peut passer l'année : Quadrantides). */
  readonly activeTo: readonly [number, number]
  /** Longitude solaire du maximum, équinoxe J2000, en degrés (référence IMO). */
  readonly peakSolarLongitudeDeg: number
  readonly radiantRaDeg: number
  readonly radiantDecDeg: number
  /** Taux horaire zénithal au maximum (ZHR). */
  readonly zhr: number
  /** Vitesse géocentrique d'entrée en km/s. */
  readonly velocityKmS: number
  /** Indice de population r (distribution des magnitudes). */
  readonly populationIndex: number
  readonly parentBody: string
  /** Activité très variable d'une année à l'autre (sursauts possibles). */
  readonly variable: boolean
}
