/**
 * Outils géodésiques et textuels du sélecteur de lieu (aucune mécanique céleste ici).
 */
import type { ObserverLocation } from '../../types/astro'

const EARTH_RADIUS_KM = 6371.0088

/** Distance orthodromique (formule de haversine sur sphère moyenne IUGG), en km. */
export function haversineKm(
  a: Pick<ObserverLocation, 'latitudeDeg' | 'longitudeDeg'>,
  b: Pick<ObserverLocation, 'latitudeDeg' | 'longitudeDeg'>,
): number {
  const toRad = Math.PI / 180
  const dLatRad = (b.latitudeDeg - a.latitudeDeg) * toRad
  const dLonRad = (b.longitudeDeg - a.longitudeDeg) * toRad
  const h =
    Math.sin(dLatRad / 2) ** 2 +
    Math.cos(a.latitudeDeg * toRad) * Math.cos(b.latitudeDeg * toRad) * Math.sin(dLonRad / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Normalise un texte pour la recherche : minuscules, sans accents ni ponctuation. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

let regionNames: Intl.DisplayNames | null | undefined

/** Nom français d'un pays à partir de son code ISO 3166-1 alpha-2. */
export function countryNameFr(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['fr'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** Identifiant stable d'un site à ~11 m près. */
export function siteIdFor(loc: Pick<ObserverLocation, 'latitudeDeg' | 'longitudeDeg'>): string {
  return `site:${loc.latitudeDeg.toFixed(4)},${loc.longitudeDeg.toFixed(4)}`
}
