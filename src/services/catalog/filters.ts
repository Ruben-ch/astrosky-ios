/**
 * Filtres combinables de l'encyclopédie (familles, catalogues, magnitude
 * limite, « observable maintenant ») et tris. Les positions sont calculées par
 * le projecteur J2000 → horizontal d'astronomy-engine à l'heure simulée.
 */
import type { SkyProjector } from '../astro/skyProjector'
import type { CatalogFilters, CatalogMatch, CatalogSort, DeepSkyEntry } from '../../types/encyclopedia'
import { searchEntries } from './search'

/** Hauteur minimale pour qu'un objet soit « observable maintenant », en degrés. */
export const OBSERVABLE_MIN_ALT_DEG = 15

/** Bornes du curseur de magnitude limite. */
export const MAG_LIMIT_RANGE = { min: 3, max: 12, step: 0.5 } as const

export const DEFAULT_FILTERS: CatalogFilters = { groups: [], sources: [], magLimit: null, observableNow: false, sort: 'altitude' }

export const SORT_LABEL_FR: Readonly<Record<CatalogSort, string>> = {
  altitude: 'Hauteur',
  magnitude: 'Éclat',
  catalog: 'Numéro',
  size: 'Taille',
}

/** L'entrée satisfait-elle les filtres statiques (hors hauteur) ? */
export function matchesStaticFilters(e: DeepSkyEntry, f: CatalogFilters): boolean {
  if (f.groups.length > 0 && (e.group === null || !f.groups.includes(e.group))) return false
  if (f.sources.length > 0 && !e.sources.some((s) => f.sources.includes(s))) return false
  if (f.magLimit !== null && (e.object.mag === null || e.object.mag > f.magLimit)) return false
  return true
}

/** Rang de catalogue : Messier par numéro, puis NGC, puis IC. */
function catalogRank(e: DeepSkyEntry): number {
  const o = e.object
  if (o.messier !== null) return o.messier
  const n = /^(NGC|IC)\s*(\d+)/.exec(o.ngc ?? '')
  return (n?.[1] === 'IC' ? 20_000 : 1_000) + Number(n?.[2] ?? 0)
}

function compare(sort: CatalogSort, a: CatalogMatch, b: CatalogMatch): number {
  switch (sort) {
    case 'altitude':
      return b.altitudeDeg - a.altitudeDeg
    case 'magnitude':
      return (a.entry.object.mag ?? 99) - (b.entry.object.mag ?? 99)
    case 'size':
      return (b.entry.object.sizeMajorArcmin ?? 0) - (a.entry.object.sizeMajorArcmin ?? 0)
    case 'catalog':
      return catalogRank(a.entry) - catalogRank(b.entry)
  }
}

/**
 * Applique recherche + filtres et trie : par pertinence si une requête est
 * saisie (puis selon `filters.sort`), sinon selon `filters.sort` seul.
 */
export function applyCatalogFilters(
  entries: readonly DeepSkyEntry[],
  query: string,
  filters: CatalogFilters,
  project: SkyProjector,
): CatalogMatch[] {
  const hasQuery = query.trim().length > 0
  const out: CatalogMatch[] = []
  for (const { entry, score } of searchEntries(entries, query)) {
    if (!matchesStaticFilters(entry, filters)) continue
    const pos = project(entry.object.raDeg, entry.object.decDeg)
    if (filters.observableNow && pos.altitudeDeg <= OBSERVABLE_MIN_ALT_DEG) continue
    out.push({ entry, score: hasQuery ? score : 0, altitudeDeg: pos.altitudeDeg, azimuthDeg: pos.azimuthDeg })
  }
  return out.sort((a, b) => b.score - a.score || compare(filters.sort, a, b))
}

/** Nombre de filtres actifs (pour la pastille du bouton « Filtres »). */
export function activeFilterCount(f: CatalogFilters): number {
  return (f.groups.length > 0 ? 1 : 0) + (f.sources.length > 0 ? 1 : 0) + (f.magLimit !== null ? 1 : 0) + (f.observableNow ? 1 : 0)
}

/** Ajoute ou retire `value` d'une liste (bascule de puce). */
export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
