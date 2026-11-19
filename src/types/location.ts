/** Types du sélecteur de lieu : recherche de villes, favoris et sites récents. */
import type { ObserverLocation } from './astro'

/** Origine d'un résultat de recherche de ville. */
export type CitySource = 'offline' | 'online'

export interface CityResult extends ObserverLocation {
  /** Identifiant stable (`geonames:<id>`), partagé par le catalogue et Open-Meteo. */
  readonly id: string
  readonly name: string
  /** Code pays ISO 3166-1 alpha-2 (`"FR"`). */
  readonly countryCode: string
  /** Nom du pays en français (Intl.DisplayNames), ou code si indisponible. */
  readonly country: string
  /** Région administrative de niveau 1, chaîne vide si inconnue. */
  readonly region: string
  readonly population: number
  readonly source: CitySource
}

export interface CitySearchResponse {
  readonly query: string
  readonly results: readonly CityResult[]
  /** `online` = Open-Meteo joignable (ou cache), `offline` = catalogue embarqué seul. */
  readonly mode: 'online' | 'offline'
}

/** Site d'observation enregistré par l'utilisateur (favori ou récent). */
export interface SavedSite extends ObserverLocation {
  readonly id: string
  readonly label: string
  /** Complément affiché sous le nom (région, pays…), chaîne vide sinon. */
  readonly detail: string
  /** Horodatage Unix (ms) d'enregistrement ou de dernière utilisation. */
  readonly savedAt: number
}
