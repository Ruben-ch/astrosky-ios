/**
 * Sites d'observation enregistrés : favoris (jusqu'à 30) et récents (6),
 * persistés hors-ligne via le cache (Preferences natif / localStorage).
 */
import type { ObserverLocation } from '../../types/astro'
import type { SavedSite } from '../../types/location'
import { cacheGet, cacheSet } from '../cache'
import { haversineKm, siteIdFor } from './geodesy'
import { validateLocation } from '../locationService'

const FAVORITES_KEY = 'sites:favorites'
const RECENTS_KEY = 'sites:recent'
const TTL_MS = 10 * 365 * 86_400_000
export const MAX_FAVORITES = 30
export const MAX_RECENTS = 6
/** Deux sites à moins de cette distance sont considérés identiques. */
export const SAME_SITE_KM = 0.5

export function makeSavedSite(loc: ObserverLocation, label: string, detail = '', nowMs = Date.now()): SavedSite {
  const v = validateLocation(loc)
  return { ...v, id: siteIdFor(v), label: label.trim() || 'Site sans nom', detail, savedAt: nowMs }
}

async function readList(key: string): Promise<SavedSite[]> {
  const list = await cacheGet<SavedSite[]>(key)
  return Array.isArray(list) ? list.filter((s) => Number.isFinite(s?.latitudeDeg) && Number.isFinite(s?.longitudeDeg)) : []
}

/** Site déjà présent dans la liste (à `SAME_SITE_KM` près), ou `undefined`. */
export function findSameSite(list: readonly SavedSite[], loc: Pick<ObserverLocation, 'latitudeDeg' | 'longitudeDeg'>): SavedSite | undefined {
  return list.find((s) => haversineKm(s, loc) < SAME_SITE_KM)
}

export function listFavorites(): Promise<SavedSite[]> {
  return readList(FAVORITES_KEY)
}

/** Ajoute (ou renomme) un favori ; le plus récent en tête. */
export async function addFavorite(site: SavedSite): Promise<SavedSite[]> {
  const list = (await listFavorites()).filter((s) => haversineKm(s, site) >= SAME_SITE_KM)
  const next = [site, ...list].slice(0, MAX_FAVORITES)
  await cacheSet(FAVORITES_KEY, next, TTL_MS)
  return next
}

export async function removeFavorite(id: string): Promise<SavedSite[]> {
  const next = (await listFavorites()).filter((s) => s.id !== id)
  await cacheSet(FAVORITES_KEY, next, TTL_MS)
  return next
}

/** Bascule l'état favori d'un site ; renvoie la nouvelle liste. */
export async function toggleFavorite(site: SavedSite): Promise<SavedSite[]> {
  const list = await listFavorites()
  const existing = findSameSite(list, site)
  return existing ? removeFavorite(existing.id) : addFavorite(site)
}

export function listRecents(): Promise<SavedSite[]> {
  return readList(RECENTS_KEY)
}

/** Mémorise un site utilisé (dédoublonné, plafonné à `MAX_RECENTS`). */
export async function pushRecent(site: SavedSite): Promise<SavedSite[]> {
  const list = (await listRecents()).filter((s) => haversineKm(s, site) >= SAME_SITE_KM)
  const next = [site, ...list].slice(0, MAX_RECENTS)
  await cacheSet(RECENTS_KEY, next, TTL_MS)
  return next
}
