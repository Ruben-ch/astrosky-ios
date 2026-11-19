/**
 * Types des services « Espace » : calendrier des lancements (Launch Library 2,
 * The Space Devs) et Image Astronomique du Jour (NASA APOD).
 */

// ─── Launch Library 2 : réponse brute (champs lus) ─────────────────────
export interface Ll2LaunchRaw {
  readonly id?: string
  readonly name?: string
  readonly net?: string
  readonly window_start?: string | null
  readonly window_end?: string | null
  readonly net_precision?: { readonly name?: string; readonly abbrev?: string } | null
  readonly probability?: number | null
  readonly holdreason?: string | null
  readonly failreason?: string | null
  readonly webcast_live?: boolean
  readonly image?: string | null
  readonly status?: { readonly abbrev?: string; readonly name?: string; readonly description?: string } | null
  readonly launch_service_provider?: { readonly name?: string; readonly type?: string | null } | null
  readonly rocket?: { readonly configuration?: { readonly name?: string; readonly family?: string; readonly full_name?: string; readonly variant?: string } | null } | null
  readonly mission?: {
    readonly name?: string
    readonly description?: string | null
    readonly type?: string | null
    readonly orbit?: { readonly name?: string; readonly abbrev?: string } | null
  } | null
  readonly pad?: {
    readonly name?: string
    readonly latitude?: string | number | null
    readonly longitude?: string | number | null
    readonly location?: { readonly name?: string; readonly country_code?: string } | null
  } | null
}

// ─── Lancements normalisés ─────────────────────────────────────────────
export type LaunchStatus = 'go' | 'tbc' | 'tbd' | 'hold' | 'in-flight' | 'success' | 'failure' | 'partial-failure' | 'unknown'

export interface Launch {
  readonly id: string
  /** Nom complet « Lanceur | Mission ». */
  readonly name: string
  readonly missionName: string
  readonly missionDescription: string | null
  readonly missionType: string | null
  readonly orbit: string | null
  /** Heure de lancement prévue (NET : « pas avant »). */
  readonly net: Date
  /** Précision de la date (`"Hour"`, `"Day"`, `"Month"`…), `null` si exacte à la seconde. */
  readonly netPrecision: string | null
  readonly windowStart: Date | null
  readonly windowEnd: Date | null
  readonly status: LaunchStatus
  readonly statusLabel: string
  readonly statusDescription: string | null
  readonly provider: string
  readonly rocket: string
  readonly rocketFamily: string | null
  readonly pad: string
  readonly location: string
  /** Code pays ISO 3166-1 alpha-3 du site de lancement. */
  readonly countryCode: string | null
  readonly padLatitudeDeg: number | null
  readonly padLongitudeDeg: number | null
  /** Probabilité météo favorable (%), `null` si non publiée. */
  readonly probabilityPct: number | null
  readonly holdReason: string | null
  readonly imageUrl: string | null
  readonly webcastLive: boolean
}

export type SpaceDataOrigin = 'network' | 'cache' | 'stale-cache' | 'bundled'

export interface LaunchSet {
  readonly launches: readonly Launch[]
  readonly fetchedAt: number
  readonly origin: SpaceDataOrigin
}

export interface Countdown {
  /** `-1` avant l'instant (T−), `+1` après (T+). */
  readonly sign: -1 | 1
  readonly days: number
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
  readonly totalMs: number
}

// ─── NASA APOD ─────────────────────────────────────────────────────────
export interface ApodApiRaw {
  readonly date?: string
  readonly title?: string
  readonly explanation?: string
  readonly media_type?: string
  readonly url?: string
  readonly hdurl?: string
  readonly thumbnail_url?: string
  readonly copyright?: string | null
}

export type ApodMediaType = 'image' | 'video' | 'other'

export interface ApodEntry {
  /** Date de publication (fuseau de la NASA, US/Eastern), `"AAAA-MM-JJ"`. */
  readonly date: string
  readonly title: string
  readonly explanation: string
  readonly mediaType: ApodMediaType
  /** Image standard ou URL d'intégration vidéo. */
  readonly url: string | null
  readonly hdUrl: string | null
  readonly thumbnailUrl: string | null
  readonly copyright: string | null
  /** Réponse générique de l'API (média de remplacement) : média jugé indisponible. */
  readonly placeholderMedia: boolean
}

export interface ApodResult {
  readonly entry: ApodEntry
  readonly fetchedAt: number
  readonly origin: SpaceDataOrigin
  /** Date demandée (peut différer de `entry.date` si la NASA n'a pas encore publié). */
  readonly requestedDate: string
}
