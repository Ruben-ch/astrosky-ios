/**
 * Types du planétarium (onglet « Ciel ») : vue, projection, couches, capteurs,
 * sélection et guidage vers une cible.
 * Repère horizontal local ENU : x = Est, y = Nord, z = Zénith (vecteurs unitaires).
 */
import type { SolarSystemBodyId } from './astro'
import type { DeepSkyType } from './catalog'

export type Vec3 = readonly [number, number, number]

/**
 * Projection azimutale du ciel sur l'écran. `gnomonic` (rectilinéaire, comme un
 * objectif photo) est réservée au mode Caméra AR : les grands cercles restent droits.
 */
export type ProjectionKind = 'stereographic' | 'equidistant' | 'gnomonic'

export interface SkyView {
  /** Azimut du centre de vue, degrés [0, 360) depuis le nord vers l'est. */
  readonly azimuthDeg: number
  /** Hauteur du centre de vue, degrés [−90, 90]. */
  readonly altitudeDeg: number
  /** Champ horizontal (largeur d'écran), degrés. */
  readonly fovDeg: number
  /** Rotation de l'image autour de l'axe de visée (capteurs), degrés, sens trigonométrique. */
  readonly rollDeg: number
}

export interface Viewport {
  /** Dimensions CSS du canevas. */
  readonly width: number
  readonly height: number
}

/** Point projeté : coordonnées CSS et cosinus de l'écart au centre (−1 = opposé). */
export interface ScreenPoint {
  readonly x: number
  readonly y: number
  readonly cosFromCenter: number
}

export interface SkyLayers {
  readonly constellationLines: boolean
  readonly constellationNames: boolean
  readonly starNames: boolean
  readonly altAzGrid: boolean
  readonly equatorialGrid: boolean
  readonly ecliptic: boolean
  readonly milkyWay: boolean
  readonly deepSky: boolean
  readonly planets: boolean
  readonly horizon: boolean
}

/** Pilotage : doigt, capteurs inertiels, ou caméra arrière AR (capteurs + vidéo en direct). */
export type SkyControlMode = 'touch' | 'sensors' | 'ar'

export interface SkySettings {
  readonly layers: SkyLayers
  readonly projection: ProjectionKind
  readonly mode: SkyControlMode
}

/** Échantillon brut d'orientation (DeviceOrientationEvent), angles en degrés. */
export interface OrientationSample {
  readonly alphaDeg: number | null
  readonly betaDeg: number | null
  readonly gammaDeg: number | null
  /** Cap boussole iOS (`webkitCompassHeading`), degrés depuis le nord, horaire. */
  readonly compassHeadingDeg: number | null
  /** `true` si `alpha` est déjà référencé au nord (deviceorientationabsolute). */
  readonly absolute: boolean
  /** Horodatage (ms, horloge monotone). */
  readonly timeMs: number
}

/** Direction de visée de la caméra arrière et roulis de l'appareil. */
export interface CameraPose {
  readonly direction: Vec3
  /** Axe « haut » de l'écran, dans le repère ENU. */
  readonly up: Vec3
}

export type SkyObjectKind = 'star' | 'deep-sky' | 'planet' | 'moon' | 'sun' | 'satellite'

/** Objet céleste sélectionnable dans le planétarium. */
export interface SkyObjectRef {
  /** Clé partagée avec le Catalogue (`"HIP32349"`, `"M31"`, `"Jupiter"`, `"Moon"`). */
  readonly key: string
  readonly kind: SkyObjectKind
  readonly label: string
  readonly magnitude: number | null
  /** Coordonnées J2000 (fixes) ou apparentes de la date (astres mobiles), degrés. */
  readonly raDeg: number
  readonly decDeg: number
  readonly bodyId: SolarSystemBodyId | null
  readonly deepSkyType: DeepSkyType | null
  /** Satellite artificiel (clé `"SAT<norad>"`) : position propagée par SGP4 à chaque image. */
  readonly noradId?: number | null
}

export type GuidanceEvent = 'lock' | 'unlock' | 'pulse'

export interface GuidanceReading {
  /** Écart angulaire centre de vue → cible, degrés. */
  readonly separationDeg: number
  /** Direction de la cible à l'écran, radians (0 = droite, π/2 = haut). */
  readonly screenAngleRad: number
  /** Cible sous l'horizon. */
  readonly belowHorizon: boolean
}
