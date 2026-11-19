/**
 * En-tête collant du Catalogue : segments (ciel profond / étoiles / système
 * solaire), recherche instantanée, accès aux filtres et puces de familles.
 */
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { GROUP_LABEL_FR, GROUP_ORDER } from '../../services/catalog/entries'
import { OBSERVABLE_MIN_ALT_DEG, SORT_LABEL_FR, activeFilterCount, toggleIn } from '../../services/catalog/filters'
import { hapticSelection } from '../../services/haptics'
import type { CatalogFilters, DsoTypeGroup } from '../../types/encyclopedia'
import { Chip } from '../ui/Controls'
import { CATALOG_SEGMENTS, type CatalogSegment } from './catalogItems'

interface Props {
  segment: CatalogSegment
  onSegment(s: CatalogSegment): void
  query: string
  onQuery(q: string): void
  filters: CatalogFilters
  onFilters(f: CatalogFilters): void
  counts: Readonly<Record<DsoTypeGroup, number>>
  onOpenFilters(): void
  resultCount: number
  aboveCount: number
}

const PLACEHOLDER: Record<CatalogSegment, string> = {
  'deep-sky': 'M42, NGC 7000, Andromède, Orion…',
  stars: 'Véga, α Lyr, Lyre…',
  planets: 'Jupiter, Lune…',
}

export function CatalogToolbar({ segment, onSegment, query, onQuery, filters, onFilters, counts, onOpenFilters, resultCount, aboveCount }: Props) {
  const deep = segment === 'deep-sky'
  const active = activeFilterCount(filters)
  return (
    <div className="sticky top-0 z-10 space-y-2.5 border-b border-hairline bg-bg-primary/95 px-4 pt-2 pb-2.5 backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-soft p-1" role="radiogroup" aria-label="Catalogue">
        {CATALOG_SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={segment === s.id}
            onClick={() => {
              if (segment !== s.id) void hapticSelection()
              onSegment(s.id)
            }}
            className={`flex min-h-11 flex-col items-center justify-center rounded-xl leading-tight ${segment === s.id ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
          >
            <span className="text-[12px] font-semibold">{s.label}</span>
            <span className="text-[10px] tabular-nums opacity-80">{s.count}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-softer pl-3 ring-accent focus-within:ring-1">
          <Search size={16} className="shrink-0 text-secondary" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={PLACEHOLDER[segment]}
            aria-label="Rechercher dans le catalogue"
            enterKeyHint="search"
            autoCorrect="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-tertiary"
          />
          {query && (
            <button type="button" onClick={() => onQuery('')} aria-label="Vider le champ de recherche" className="flex size-11 shrink-0 items-center justify-center text-secondary">
              <X size={16} />
            </button>
          )}
        </label>
        {deep && (
          <button
            type="button"
            onClick={() => {
              void hapticSelection()
              onOpenFilters()
            }}
            aria-label={`Filtres${active ? ` (${active} actifs)` : ''}`}
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-accent-soft text-accent' : 'bg-softer text-secondary'}`}
          >
            <SlidersHorizontal size={18} />
            {active > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg-primary tabular-nums">{active}</span>
            )}
          </button>
        )}
      </div>
      {deep && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-h-scroll role="group" aria-label="Filtres rapides">
          <Chip role="switch" active={filters.observableNow} ariaLabel={`Observable maintenant (hauteur > ${OBSERVABLE_MIN_ALT_DEG}°)`} onToggle={() => onFilters({ ...filters, observableNow: !filters.observableNow })}>
            Observable
          </Chip>
          {GROUP_ORDER.map((g) => (
            <Chip key={g} active={filters.groups.includes(g)} onToggle={() => onFilters({ ...filters, groups: toggleIn(filters.groups, g) })}>
              {GROUP_LABEL_FR[g]} <span className="opacity-70">{counts[g]}</span>
            </Chip>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[11px] text-tertiary tabular-nums">
        <span role="status">
          {resultCount} objet{resultCount > 1 ? 's' : ''} · {aboveCount} au-dessus de l’horizon
        </span>
        <span>{deep ? `Tri : ${SORT_LABEL_FR[filters.sort]}` : 'Mag · Hauteur'}</span>
      </div>
    </div>
  )
}
