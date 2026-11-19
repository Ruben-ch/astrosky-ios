/** Préférences du planétarium (couches, projection, mode), persistées hors-ligne. */
import type { SkyLayers, SkySettings } from '../../types/sky'
import { cacheGet, cacheSet } from '../cache'

const KEY = 'sky:settings'
const TTL_MS = 365 * 86_400_000

export const DEFAULT_LAYERS: SkyLayers = {
  constellationLines: true,
  constellationNames: true,
  starNames: true,
  altAzGrid: false,
  equatorialGrid: false,
  ecliptic: true,
  milkyWay: true,
  deepSky: true,
  planets: true,
  horizon: true,
}

export const DEFAULT_SKY_SETTINGS: SkySettings = { layers: DEFAULT_LAYERS, projection: 'stereographic', mode: 'touch' }

/** Fusionne une valeur stockée (éventuellement partielle ou d'une ancienne version). */
export function sanitizeSettings(raw: unknown): SkySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SKY_SETTINGS
  const r = raw as Partial<SkySettings>
  const layers = { ...DEFAULT_LAYERS }
  if (r.layers && typeof r.layers === 'object') {
    for (const k of Object.keys(DEFAULT_LAYERS) as (keyof SkyLayers)[]) {
      const v = (r.layers as Partial<SkyLayers>)[k]
      if (typeof v === 'boolean') layers[k] = v
    }
  }
  return {
    layers,
    projection: r.projection === 'equidistant' ? 'equidistant' : 'stereographic',
    // Les capteurs exigent une autorisation à chaque session : on repart en tactile.
    mode: 'touch',
  }
}

export async function loadSkySettings(): Promise<SkySettings> {
  return sanitizeSettings(await cacheGet<SkySettings>(KEY))
}

export async function saveSkySettings(settings: SkySettings): Promise<void> {
  await cacheSet(KEY, settings, TTL_MS)
}
