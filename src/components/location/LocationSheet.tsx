/**
 * Feuille modale du site d'observation : position courante, GPS, recherche de
 * villes (en ligne / hors-ligne), favoris, sites récents et saisie manuelle.
 */
import { Clock, LocateFixed, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useObserver } from '../../hooks/useAppContext'
import { useSavedSites } from '../../hooks/useSavedSites'
import { cityDetail } from '../../services/location/citySearch'
import { siteIdFor } from '../../services/location/geodesy'
import { findSameSite, makeSavedSite } from '../../services/location/savedSites'
import { formatLatitude, formatLongitude, maidenheadLocator } from '../../services/locationService'
import type { ObserverLocation } from '../../types/astro'
import type { SavedSite } from '../../types/location'
import { Readout } from '../ui/Card'
import { fmtNumber } from '../ui/format'
import { CitySearchPanel } from './CitySearchPanel'
import { ManualEntryForm } from './ManualEntryForm'
import { SectionTitle, SiteRow } from './SiteRow'

const SOURCE_FR = { gps: 'GPS', cache: 'Cache', manual: 'Manuel', default: 'Par défaut' } as const

export function LocationSheet({ onClose }: { onClose(): void }) {
  const { location, locating, error, permission, refreshGps, selectSite, unpinManual } = useObserver()
  const { favorites, recents, toggle, remove } = useSavedSites()
  const [query, setQuery] = useState('')
  const currentId = siteIdFor(location)
  const currentFavorite = findSameSite(favorites, location) !== undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choose = async (loc: ObserverLocation, label: string, detail = '') => {
    await selectSite(loc, label, detail)
    onClose()
  }
  const siteRow = (s: SavedSite, kind: 'favorite' | 'recent') => (
    <SiteRow
      key={`${kind}-${s.id}`}
      title={s.label}
      detail={s.detail || `${formatLatitude(s.latitudeDeg)} ${formatLongitude(s.longitudeDeg)}`}
      elevationM={s.elevationM}
      icon={kind === 'favorite' ? <Star size={18} /> : <Clock size={18} />}
      favorite={kind === 'favorite' || findSameSite(favorites, s) !== undefined}
      current={s.id === currentId}
      onSelect={() => void choose(s, s.label, s.detail)}
      onToggleFavorite={() => void toggle(s)}
      onRemove={kind === 'favorite' ? () => void remove(s.id) : undefined}
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-bg-primary/80" role="dialog" aria-modal="true" aria-label="Site d'observation">
      <button type="button" data-sheet-backdrop className="min-h-11 flex-1" aria-label="Fermer" onClick={onClose} />
      <div className="pb-safe flex max-h-[90dvh] flex-col rounded-t-[28px] bg-elevated">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-strong" aria-hidden />
        <div className="flex min-h-12 shrink-0 items-center px-4">
          <h2 className="flex-1 text-[17px] font-semibold">Site d'observation</h2>
          <button type="button" onClick={onClose} aria-label="Fermer la feuille" className="touch-target -mr-2 flex items-center justify-center text-secondary">
            <X size={20} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
          <section className="rounded-[22px] bg-soft p-3" aria-label="Site actuel">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{location.label}</div>
                <div className="truncate text-[11px] text-secondary tabular-nums">{formatLatitude(location.latitudeDeg)} · {formatLongitude(location.longitudeDeg)}</div>
              </div>
              <button
                type="button"
                onClick={() => void toggle(makeSavedSite(location, location.label))}
                aria-pressed={currentFavorite}
                aria-label={currentFavorite ? 'Retirer le site actuel des favoris' : 'Ajouter le site actuel aux favoris'}
                className={`touch-target -mr-2 flex items-center justify-center ${currentFavorite ? 'text-accent' : 'text-tertiary'}`}
              >
                <Star size={20} fill={currentFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 border-t border-hairline pt-2">
              <Readout label="Altitude" value={fmtNumber(location.elevationM)} unit="m" />
              <Readout label="Source" value={SOURCE_FR[location.source]} />
              <Readout label="Précision" value={location.accuracyM ? `±${fmtNumber(location.accuracyM)}` : '—'} unit={location.accuracyM ? 'm' : undefined} />
              <Readout label="Locator" value={maidenheadLocator(location.latitudeDeg, location.longitudeDeg)} />
            </div>
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refreshGps()}
              disabled={locating}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft font-semibold text-accent active:opacity-80 disabled:opacity-60"
            >
              <LocateFixed size={18} className={locating ? 'animate-pulse' : ''} aria-hidden />
              {locating ? 'Acquisition GPS…' : 'Ma position GPS'}
            </button>
            {location.source === 'manual' && (
              <button type="button" onClick={() => void unpinManual()} className="min-h-12 rounded-2xl bg-softer px-4 text-[13px] text-secondary">
                Désépingler
              </button>
            )}
          </div>
          {(error || permission === 'denied') && (
            <p className="text-[12px] text-poor" role="alert">{permission === 'denied' ? 'Accès à la position refusé — autorisez-le dans Réglages › AstroSky.' : error}</p>
          )}

          <CitySearchPanel
            query={query}
            onQueryChange={setQuery}
            favorites={favorites}
            onSelect={(c) => void choose(c, c.name, cityDetail(c))}
            onToggleFavorite={(s) => void toggle(s)}
          />

          {!query && (
            <>
              <section aria-label="Sites favoris">
                <SectionTitle aside={<span className="text-[11px] text-tertiary tabular-nums">{favorites.length}</span>}>Favoris</SectionTitle>
                {favorites.length === 0 ? (
                  <p className="py-2 text-[13px] text-secondary">Touchez l'étoile d'un site pour l'ajouter à vos favoris.</p>
                ) : (
                  <ul>{favorites.map((s) => siteRow(s, 'favorite'))}</ul>
                )}
              </section>
              {recents.length > 0 && (
                <section aria-label="Sites récents">
                  <SectionTitle>Récents</SectionTitle>
                  <ul>{recents.map((s) => siteRow(s, 'recent'))}</ul>
                </section>
              )}
            </>
          )}

          <ManualEntryForm location={location} onSubmit={(loc, label) => choose(loc, label)} />
        </div>
      </div>
    </div>
  )
}
