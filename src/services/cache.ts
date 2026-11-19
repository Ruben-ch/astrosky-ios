/**
 * Cache clé/valeur persistant avec TTL, utilisable hors-ligne.
 * - Natif iOS : `@capacitor/preferences` (UserDefaults).
 * - Web : `localStorage` (accès protégé par try/catch : navigation privée).
 * Les entrées expirées restent lisibles via `readStale` pour le mode dégradé.
 */
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export interface KeyValueStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export interface CacheEntry<T> {
  readonly value: T
  /** Horodatage Unix (ms) d'écriture. */
  readonly storedAt: number
  /** Durée de validité en millisecondes. */
  readonly ttlMs: number
}

const PREFIX = 'astrosky:'

export const localStorageAdapter: KeyValueStorage = {
  async get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  async set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      /* quota dépassé ou stockage bloqué : le cache reste optionnel */
    }
  },
  async remove(key) {
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      /* ignoré */
    }
  },
}

export const preferencesAdapter: KeyValueStorage = {
  async get(key) {
    return (await Preferences.get({ key })).value
  },
  async set(key, value) {
    await Preferences.set({ key, value })
  },
  async remove(key) {
    await Preferences.remove({ key })
  },
}

let storage: KeyValueStorage = Capacitor.isNativePlatform() ? preferencesAdapter : localStorageAdapter

/** Remplace le stockage sous-jacent (tests unitaires, migration). */
export function setCacheStorage(next: KeyValueStorage): void {
  storage = next
}

async function readEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await storage.get(PREFIX + key)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (typeof parsed?.storedAt !== 'number' || typeof parsed?.ttlMs !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function isFresh(entry: CacheEntry<unknown>, nowMs: number = Date.now()): boolean {
  return nowMs - entry.storedAt < entry.ttlMs
}

/** Lit une valeur encore valide, ou `null` si absente/expirée. */
export async function cacheGet<T>(key: string, nowMs: number = Date.now()): Promise<T | null> {
  const entry = await readEntry<T>(key)
  return entry && isFresh(entry, nowMs) ? entry.value : null
}

/** Lit une entrée même expirée (mode hors-ligne), avec ses métadonnées. */
export async function cacheReadStale<T>(key: string): Promise<CacheEntry<T> | null> {
  return readEntry<T>(key)
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number, nowMs: number = Date.now()): Promise<void> {
  const entry: CacheEntry<T> = { value, storedAt: nowMs, ttlMs }
  await storage.set(PREFIX + key, JSON.stringify(entry))
}

export async function cacheRemove(key: string): Promise<void> {
  await storage.remove(PREFIX + key)
}

export type CachedOrigin = 'network' | 'cache' | 'stale-cache'

export interface CachedResult<T> {
  readonly value: T
  readonly storedAt: number
  readonly origin: CachedOrigin
}

/**
 * Stratégie « cache d'abord, réseau ensuite, cache périmé en secours ».
 * Lève l'erreur réseau uniquement si aucune donnée (même périmée) n'existe.
 */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: { force?: boolean; nowMs?: number } = {},
): Promise<CachedResult<T>> {
  const nowMs = options.nowMs ?? Date.now()
  const entry = await readEntry<T>(key)
  if (!options.force && entry && isFresh(entry, nowMs)) {
    return { value: entry.value, storedAt: entry.storedAt, origin: 'cache' }
  }
  try {
    const value = await fetcher()
    await cacheSet(key, value, ttlMs, nowMs)
    return { value, storedAt: nowMs, origin: 'network' }
  } catch (error) {
    if (entry) return { value: entry.value, storedAt: entry.storedAt, origin: 'stale-cache' }
    throw error
  }
}
