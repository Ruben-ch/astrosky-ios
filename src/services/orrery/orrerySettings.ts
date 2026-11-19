/** Préférences du Système Solaire 3D (vue, orbites, étiquettes, suivi), persistées hors-ligne. */
import type { OrrerySettings } from '../../types/orrery'
import { cacheGet, cacheSet } from '../cache'

const KEY = 'orrery:settings'
const TTL_MS = 365 * 86_400_000

export const DEFAULT_ORRERY_SETTINGS: OrrerySettings = { viewMode: 'ecliptic', showOrbits: true, showLabels: true, follow: true }

/** Fusionne une valeur stockée (partielle, corrompue ou d'une ancienne version) avec les défauts. */
export function sanitizeOrrerySettings(raw: unknown): OrrerySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_ORRERY_SETTINGS
  const r = raw as Partial<Record<keyof OrrerySettings, unknown>>
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    viewMode: r.viewMode === 'polar' ? 'polar' : 'ecliptic',
    showOrbits: bool(r.showOrbits, DEFAULT_ORRERY_SETTINGS.showOrbits),
    showLabels: bool(r.showLabels, DEFAULT_ORRERY_SETTINGS.showLabels),
    follow: bool(r.follow, DEFAULT_ORRERY_SETTINGS.follow),
  }
}

export async function loadOrrerySettings(): Promise<OrrerySettings> {
  return sanitizeOrrerySettings(await cacheGet<unknown>(KEY))
}

export async function saveOrrerySettings(settings: OrrerySettings): Promise<void> {
  await cacheSet(KEY, settings, TTL_MS)
}
