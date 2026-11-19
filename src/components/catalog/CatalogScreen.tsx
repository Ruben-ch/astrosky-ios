/**
 * Écran « Catalogue » — Encyclopédie du Ciel Profond : recherche instantanée,
 * filtres combinables persistés, étoiles brillantes et système solaire.
 * Toucher une ligne verrouille la cible et ouvre sa fiche détaillée ; reçoit
 * aussi les demandes de verrouillage de « Ce soir » et du planétarium.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation, useObserver, useTheme } from '../../hooks/useAppContext'
import { usePersistedState } from '../../hooks/usePersistedState'
import { useSimTime } from '../../hooks/useSimTime'
import { createSkyProjector, getBodyHorizontal } from '../../services/astroEngine'
import { loadCatalogFilters, saveCatalogFilters } from '../../services/catalog/catalogSettings'
import { getDeepSkyEntries, groupCounts } from '../../services/catalog/entries'
import { DEFAULT_FILTERS, applyCatalogFilters } from '../../services/catalog/filters'
import { normalizeText } from '../../services/catalog/search'
import { hapticLock } from '../../services/haptics'
import type { ObserverLocation } from '../../types/astro'
import { CatalogFilterSheet } from './CatalogFilterSheet'
import { CatalogRow } from './CatalogRow'
import { CatalogToolbar } from './CatalogToolbar'
import { segmentForKey, solarSystemItems, starItems, type CatalogSegment } from './catalogItems'
import { CatalogDetail } from './detail/CatalogDetail'
import { resolveDetailTarget } from './detail/detailModel'

export function CatalogScreen() {
  const { location } = useObserver()
  const { theme, palette } = useTheme()
  const { catalogFocus, clearCatalogFocus } = useNavigation()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  const loc = useMemo<ObserverLocation>(() => ({ latitudeDeg, longitudeDeg, elevationM }), [latitudeDeg, longitudeDeg, elevationM])
  const now = useSimTime(1000, 60_000)
  const nowMs = now.getTime()
  const rootRef = useRef<HTMLDivElement>(null)
  const listScrollRef = useRef(0)

  const [segment, setSegment] = useState<CatalogSegment>(() => (catalogFocus && segmentForKey(catalogFocus.key)) || 'deep-sky')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = usePersistedState(DEFAULT_FILTERS, loadCatalogFilters, saveCatalogFilters)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [locked, setLocked] = useState<string | null>(() => catalogFocus?.key ?? null)
  const [handledNonce, setHandledNonce] = useState<number | null>(() => catalogFocus?.nonce ?? null)

  // Demande de verrouillage reçue pendant que l'écran est monté (état dérivé, sans effet).
  if (catalogFocus && catalogFocus.nonce !== handledNonce) {
    setHandledNonce(catalogFocus.nonce)
    const s = segmentForKey(catalogFocus.key)
    if (s) {
      setSegment(s)
      setLocked(catalogFocus.key)
    }
  }

  // Acquitte la demande une fois la fiche affichée.
  useEffect(() => {
    if (!catalogFocus || catalogFocus.nonce !== handledNonce) return
    const raf = requestAnimationFrame(() => clearCatalogFocus(catalogFocus.nonce))
    return () => cancelAnimationFrame(raf)
  }, [catalogFocus, handledNonce, clearCatalogFocus])

  // Fiche ouverte : haut de page ; retour à la liste : position de défilement restaurée.
  const scroller = () => rootRef.current?.closest('main') ?? null
  useEffect(() => {
    const el = scroller()
    if (!el) return
    el.scrollTo({ top: locked ? 0 : listScrollRef.current })
  }, [locked])

  const entries = getDeepSkyEntries()
  const counts = useMemo(() => groupCounts(entries), [entries])
  const project = useMemo(() => createSkyProjector(new Date(nowMs), loc), [nowMs, loc])
  const deepRows = useMemo(
    () => (segment === 'deep-sky' ? applyCatalogFilters(entries, query, filters, project) : []),
    [segment, entries, query, filters, project],
  )
  const stars = useMemo(() => (segment === 'stars' ? starItems(theme) : []), [segment, theme])
  const bodies = useMemo(() => (segment === 'planets' ? solarSystemItems(new Date(nowMs), loc, palette) : []), [segment, nowMs, loc, palette])
  const otherRows = useMemo(() => {
    const q = normalizeText(query)
    return [...stars, ...bodies]
      .filter((it) => !q || q.split(' ').every((t) => it.searchText.includes(t)))
      .map((it) => ({ it, pos: it.bodyId ? getBodyHorizontal(it.bodyId, new Date(nowMs), loc) : project(it.raDeg, it.decDeg) }))
      .sort((a, b) => b.pos.altitudeDeg - a.pos.altitudeDeg)
  }, [stars, bodies, query, nowMs, loc, project])

  const detail = useMemo(() => (locked ? resolveDetailTarget(locked) : null), [locked])
  const select = (key: string) => {
    listScrollRef.current = scroller()?.scrollTop ?? 0
    setLocked(key)
    void hapticLock()
  }

  if (detail) {
    return (
      <div ref={rootRef}>
        <CatalogDetail target={detail} onBack={() => setLocked(null)} />
      </div>
    )
  }

  const resultCount = segment === 'deep-sky' ? deepRows.length : otherRows.length
  const aboveCount = segment === 'deep-sky' ? deepRows.filter((r) => r.altitudeDeg > 0).length : otherRows.filter((r) => r.pos.altitudeDeg > 0).length

  return (
    <div ref={rootRef} className="pb-20">
      <CatalogToolbar
        segment={segment}
        onSegment={(s) => {
          setSegment(s)
          setQuery('')
        }}
        query={query}
        onQuery={setQuery}
        filters={filters}
        onFilters={setFilters}
        counts={counts}
        onOpenFilters={() => setSheetOpen(true)}
        resultCount={resultCount}
        aboveCount={aboveCount}
      />
      <ul aria-label="Résultats du catalogue">
        {segment === 'deep-sky'
          ? deepRows.map(({ entry: e, altitudeDeg, azimuthDeg }) => (
              <CatalogRow
                key={e.object.id}
                rowKey={e.object.id}
                code={e.code}
                name={e.object.name ?? e.code}
                subtitle={`${e.typeLabel} · ${e.constellationFr}${e.aliases.length ? ` · ${e.aliases[0]}` : ''}`}
                mag={e.object.mag}
                sizeArcmin={e.object.sizeMajorArcmin}
                altitudeDeg={altitudeDeg}
                azimuthDeg={azimuthDeg}
                onSelect={() => select(e.object.id)}
              />
            ))
          : otherRows.map(({ it, pos }) => (
              <CatalogRow
                key={it.key}
                rowKey={it.key}
                code={it.code}
                name={it.name}
                subtitle={it.subtitle}
                mag={it.mag}
                swatch={it.swatch}
                altitudeDeg={pos.altitudeDeg}
                azimuthDeg={pos.azimuthDeg}
                onSelect={() => select(it.key)}
              />
            ))}
      </ul>
      {resultCount === 0 && (
        <p className="px-6 py-10 text-center text-[14px] text-secondary">
          Aucun objet ne correspond{segment === 'deep-sky' ? ' à la recherche et aux filtres.' : ' à la recherche.'}
        </p>
      )}
      {sheetOpen && (
        <CatalogFilterSheet filters={filters} counts={counts} resultCount={resultCount} onChange={setFilters} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
