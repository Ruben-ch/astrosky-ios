/**
 * Types de l'Encyclopédie du Ciel Profond (onglet Catalogue) : entrées enrichies,
 * recherche et filtres, profil d'élévation nocturne, saison idéale et conseils
 * d'observation par instrument. Instants en `Date` UTC ; angles suffixés.
 */
import type { AltitudeSample, RiseTransitSet } from './astro'
import type { DeepSkyObject, DeepSkyType } from './catalog'
import type { InstrumentId, TwilightSegment } from './tonight'

// ─── Données ───────────────────────────────────────────────────────────
/** Compléments OpenNGC d'un objet (src/data/deepSkyExtras.generated.ts). */
export interface DeepSkyExtra {
  /** Désignation OpenNGC de la ligne jointe (`"NGC0224"`, `"Mel022"`). */
  readonly openNgc: string
  /** Angle de position du grand axe, degrés du nord vers l'est [0, 180], `null` si non mesuré. */
  readonly positionAngleDeg: number | null
  /** Brillance de surface moyenne mesurée (mag/arcsec²), `null` si absente. */
  readonly surfaceBrightness: number | null
}

/** Familles d'objets proposées au filtrage. */
export type DsoTypeGroup = 'galaxy' | 'diffuse-nebula' | 'planetary-nebula' | 'open-cluster' | 'globular-cluster' | 'supernova-remnant'

/** Catalogue d'appartenance (un objet Messier peut aussi être NGC). */
export type CatalogSource = 'messier' | 'ngc' | 'ic'

export type SurfaceBrightnessOrigin = 'measured' | 'computed'

/** Objet du ciel profond enrichi, prêt pour la recherche et la fiche détaillée. */
export interface DeepSkyEntry {
  readonly object: DeepSkyObject
  /** Code d'affichage principal : `"M31"`, `"NGC 7000"`, `"IC 434"`. */
  readonly code: string
  /** Désignations secondaires (`["NGC 224"]` pour M31). */
  readonly aliases: readonly string[]
  readonly typeLabel: string
  readonly group: DsoTypeGroup | null
  readonly sources: readonly CatalogSource[]
  readonly constellationFr: string
  readonly constellationLatin: string
  /** Angle de position du grand axe (degrés, nord → est), `null` si inconnu. */
  readonly positionAngleDeg: number | null
  /** Brillance de surface moyenne en mag/arcsec², `null` si magnitude ou taille inconnue. */
  readonly surfaceBrightness: number | null
  readonly surfaceBrightnessOrigin: SurfaceBrightnessOrigin | null
  /** Texte normalisé (sans accents, minuscules) pour la recherche plein texte. */
  readonly searchText: string
}

// ─── Recherche & filtres ──────────────────────────────────────────────
export type CatalogSort = 'altitude' | 'magnitude' | 'catalog' | 'size'

export interface CatalogFilters {
  /** Familles retenues ; vide = toutes (y compris astérismes, étoiles doubles…). */
  readonly groups: readonly DsoTypeGroup[]
  /** Catalogues retenus ; vide = tous. */
  readonly sources: readonly CatalogSource[]
  /** Magnitude visuelle limite (incluse), `null` = aucune limite. */
  readonly magLimit: number | null
  /** Seulement les objets à plus de `OBSERVABLE_MIN_ALT_DEG` à l'heure simulée. */
  readonly observableNow: boolean
  readonly sort: CatalogSort
}

export interface CatalogMatch {
  readonly entry: DeepSkyEntry
  /** Pertinence de la recherche (0 sans requête ; plus grand = meilleur). */
  readonly score: number
  readonly altitudeDeg: number
  readonly azimuthDeg: number
}

// ─── Profil d'élévation nocturne ──────────────────────────────────────
export interface HourlyAltitude {
  /** Heure ronde (locale de l'appareil). */
  readonly time: Date
  readonly altitudeDeg: number
  readonly azimuthDeg: number
  /** Le Soleil est sous −18° à cet instant. */
  readonly dark: boolean
}

export interface Culmination {
  readonly time: Date
  readonly altitudeDeg: number
  /** Le maximum tombe dans la nuit astronomique (sinon : meilleur instant de la fenêtre affichée). */
  readonly duringDarkness: boolean
}

export interface NightElevationProfile {
  /** Fenêtre affichée : 1 h avant le coucher du Soleil → 1 h après son lever. */
  readonly start: Date
  readonly end: Date
  readonly samples: readonly AltitudeSample[]
  readonly hourly: readonly HourlyAltitude[]
  readonly segments: readonly TwilightSegment[]
  /** Hauteur maximale dans la fenêtre affichée. */
  readonly culmination: Culmination
  readonly riseTransitSet: RiseTransitSet
  /** Minutes au-dessus de `OBSERVABLE_MIN_ALT_DEG` pendant la nuit astronomique. */
  readonly observableDarkMinutes: number
}

// ─── Saison idéale ────────────────────────────────────────────────────
export interface MonthlyVisibility {
  /** Mois 0–11. */
  readonly month: number
  /** Minutes au-dessus de 30° pendant la fenêtre sombre de la mi-mois. */
  readonly darkMinutesAbove30: number
  readonly maxDarkAltitudeDeg: number
}

export interface SeasonInfo {
  readonly months: readonly MonthlyVisibility[]
  /** Mois recommandés (≥ 75 % du meilleur mois), triés dans l'ordre de la saison. */
  readonly bestMonths: readonly number[]
  /** Date (année simulée) où l'objet culmine vers minuit solaire local, `null` si jamais levé. */
  readonly midnightCulmination: Date | null
  /** Hauteur de culmination au méridien (géométrique), en degrés. */
  readonly meridianAltitudeDeg: number
  readonly circumpolar: boolean
  readonly neverRises: boolean
}

// ─── Conseils d'observation ───────────────────────────────────────────
export type ObservationVerdict = 'invisible' | 'difficult' | 'accessible' | 'easy' | 'showpiece'

export interface InstrumentAdvice {
  readonly instrument: InstrumentId
  readonly verdict: ObservationVerdict
  /** Marge entre la magnitude limite (objets étendus, ciel noir) et celle de l'objet. */
  readonly magnitudeMargin: number | null
  /** Taille du grand axe rapportée au champ typique de l'instrument. */
  readonly fieldFillRatio: number | null
  /** Grossissements conseillés [min, max], `null` à l'œil nu. */
  readonly magnificationRange: readonly [number, number] | null
  readonly tips: readonly string[]
}

export type { DeepSkyType }
