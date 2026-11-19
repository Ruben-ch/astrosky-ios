/** Filtres de l'encyclopédie persistés hors-ligne (Preferences natif / localStorage). */
import type { CatalogFilters, CatalogSort, CatalogSource, DsoTypeGroup } from '../../types/encyclopedia'
import { cacheGet, cacheSet } from '../cache'
import { GROUP_ORDER } from './entries'
import { DEFAULT_FILTERS, MAG_LIMIT_RANGE } from './filters'

const KEY = 'catalog:filters'
const TTL_MS = 365 * 86_400_000
const SOURCES: readonly CatalogSource[] = ['messier', 'ngc', 'ic']
const SORTS: readonly CatalogSort[] = ['altitude', 'magnitude', 'catalog', 'size']

/** Valide une valeur stockée (partielle, corrompue ou d'une ancienne version). */
export function sanitizeFilters(raw: unknown): CatalogFilters {
  if (!raw || typeof raw !== 'object') return DEFAULT_FILTERS
  const r = raw as Record<string, unknown>
  const pick = <T>(v: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : []
  const mag = typeof r.magLimit === 'number' && Number.isFinite(r.magLimit) ? r.magLimit : null
  return {
    groups: pick<DsoTypeGroup>(r.groups, GROUP_ORDER),
    sources: pick<CatalogSource>(r.sources, SOURCES),
    magLimit: mag === null ? null : Math.min(MAG_LIMIT_RANGE.max, Math.max(MAG_LIMIT_RANGE.min, mag)),
    observableNow: r.observableNow === true,
    sort: SORTS.includes(r.sort as CatalogSort) ? (r.sort as CatalogSort) : DEFAULT_FILTERS.sort,
  }
}

export async function loadCatalogFilters(): Promise<CatalogFilters> {
  return sanitizeFilters(await cacheGet<CatalogFilters>(KEY))
}

export async function saveCatalogFilters(filters: CatalogFilters): Promise<void> {
  await cacheSet(KEY, filters, TTL_MS)
}
