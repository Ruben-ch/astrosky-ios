/** Champ de recherche de villes et résultats (Open-Meteo + catalogue GeoNames embarqué). */
import { Building2, Loader2, Search, WifiOff, X } from 'lucide-react'
import { useCitySearch } from '../../hooks/useCitySearch'
import { cityDetail } from '../../services/location/citySearch'
import { findSameSite, makeSavedSite } from '../../services/location/savedSites'
import type { CityResult, SavedSite } from '../../types/location'
import { SiteRow } from './SiteRow'

interface Props {
  query: string
  onQueryChange(q: string): void
  favorites: readonly SavedSite[]
  onSelect(city: CityResult): void
  onToggleFavorite(site: SavedSite): void
}

export function CitySearchPanel({ query, onQueryChange, favorites, onSelect, onToggleFavorite }: Props) {
  const { response, searching } = useCitySearch(query)
  const results = response?.results ?? []

  return (
    <div>
      <label className="flex min-h-11 items-center gap-2 rounded-2xl bg-softer px-3 ring-accent focus-within:ring-1">
        {searching ? <Loader2 size={16} className="animate-spin text-accent" aria-hidden /> : <Search size={16} className="text-secondary" aria-hidden />}
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Rechercher une ville…"
          aria-label="Rechercher une ville"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-tertiary"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange('')} aria-label="Effacer la recherche" className="touch-target -mr-3 flex items-center justify-center text-secondary">
            <X size={16} />
          </button>
        )}
      </label>
      {response && (
        <div className="mt-2">
          {response.mode === 'offline' && (
            <p className="flex items-center gap-1.5 pb-1 text-[11px] text-secondary">
              <WifiOff size={12} aria-hidden /> Hors-ligne · catalogue embarqué (villes ≥ 10 000 hab. en France)
            </p>
          )}
          {results.length === 0 ? (
            <p className="py-3 text-[13px] text-secondary">Aucune ville trouvée pour « {response.query} ».</p>
          ) : (
            <ul aria-label="Résultats de recherche">
              {results.map((c) => {
                const detail = cityDetail(c)
                return (
                  <SiteRow
                    key={c.id}
                    title={c.name}
                    detail={detail}
                    elevationM={c.elevationM}
                    icon={<Building2 size={18} />}
                    favorite={findSameSite(favorites, c) !== undefined}
                    onSelect={() => onSelect(c)}
                    onToggleFavorite={() => onToggleFavorite(makeSavedSite(c, c.name, detail))}
                  />
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
