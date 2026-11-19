/**
 * Feuille « Filtres » de l'encyclopédie : familles d'objets, catalogues,
 * magnitude limite (curseur), observabilité et tri. Modifications appliquées en direct.
 */
import { X } from 'lucide-react'
import { GROUP_LABEL_FR, GROUP_ORDER, SOURCE_LABEL_FR } from '../../services/catalog/entries'
import { DEFAULT_FILTERS, MAG_LIMIT_RANGE, OBSERVABLE_MIN_ALT_DEG, SORT_LABEL_FR, toggleIn } from '../../services/catalog/filters'
import { hapticSelection, hapticTick } from '../../services/haptics'
import type { CatalogFilters, CatalogSort, CatalogSource, DsoTypeGroup } from '../../types/encyclopedia'
import { Chip, Segmented } from '../ui/Controls'
import { fmtMag } from '../ui/format'

interface Props {
  filters: CatalogFilters
  counts: Readonly<Record<DsoTypeGroup, number>>
  resultCount: number
  onChange(next: CatalogFilters): void
  onClose(): void
}

const SOURCES: readonly CatalogSource[] = ['messier', 'ngc', 'ic']
const SORTS: readonly CatalogSort[] = ['altitude', 'magnitude', 'catalog', 'size']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function CatalogFilterSheet({ filters: f, counts, resultCount, onChange, onClose }: Props) {
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...f, ...patch })
  const sliderValue = f.magLimit ?? MAG_LIMIT_RANGE.max
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-bg-primary/60" role="dialog" aria-modal="true" aria-label="Filtres du catalogue">
      <button type="button" data-sheet-backdrop className="min-h-11 flex-1" aria-label="Fermer" onClick={onClose} />
      <div className="pb-safe flex max-h-[85%] flex-col rounded-t-[28px] bg-elevated">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-strong" aria-hidden />
        <div className="flex min-h-12 shrink-0 items-center gap-2 px-4">
          <h2 className="flex-1 text-[17px] font-semibold">Filtres</h2>
          <button
            type="button"
            onClick={() => {
              void hapticSelection()
              onChange({ ...DEFAULT_FILTERS, sort: f.sort })
            }}
            className="min-h-11 px-2 text-[14px] text-accent"
          >
            Réinitialiser
          </button>
          <button type="button" onClick={onClose} aria-label="Fermer les filtres" className="touch-target -mr-2 flex items-center justify-center text-secondary">
            <X size={20} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <Section title="Type d’objet">
            <div className="flex flex-wrap gap-2">
              {GROUP_ORDER.map((g) => (
                <Chip key={g} active={f.groups.includes(g)} onToggle={() => set({ groups: toggleIn(f.groups, g) })}>
                  {GROUP_LABEL_FR[g]} <span className="opacity-70">{counts[g]}</span>
                </Chip>
              ))}
            </div>
          </Section>
          <Section title="Catalogue">
            <div className="flex gap-2">
              {SOURCES.map((s) => (
                <Chip key={s} active={f.sources.includes(s)} onToggle={() => set({ sources: toggleIn(f.sources, s) })}>
                  {SOURCE_LABEL_FR[s]}
                </Chip>
              ))}
            </div>
          </Section>
          <Section title="Magnitude limite">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={MAG_LIMIT_RANGE.min}
                max={MAG_LIMIT_RANGE.max}
                step={MAG_LIMIT_RANGE.step}
                value={sliderValue}
                aria-label="Magnitude limite"
                aria-valuetext={f.magLimit === null ? 'Toutes magnitudes' : `Jusqu’à la magnitude ${fmtMag(f.magLimit)}`}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  void hapticTick()
                  set({ magLimit: v >= MAG_LIMIT_RANGE.max ? null : v })
                }}
                className="mag-slider h-11 min-w-0 flex-1"
              />
              <span className="w-16 shrink-0 text-right text-[15px] font-medium tabular-nums">{f.magLimit === null ? 'Toutes' : `≤ ${fmtMag(f.magLimit)}`}</span>
            </div>
            <div className="flex justify-between text-[10px] text-tertiary tabular-nums">
              <span>{MAG_LIMIT_RANGE.min} · brillants</span>
              <span>faibles · {MAG_LIMIT_RANGE.max}+</span>
            </div>
          </Section>
          <Section title="Visibilité">
            <Chip role="switch" active={f.observableNow} onToggle={() => set({ observableNow: !f.observableNow })}>
              Observable maintenant · hauteur &gt; {OBSERVABLE_MIN_ALT_DEG}°
            </Chip>
          </Section>
          <Section title="Trier par">
            <Segmented label="Tri" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ id: s, label: SORT_LABEL_FR[s] }))} />
          </Section>
          <button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-soft text-[15px] font-semibold text-accent tabular-nums">
            Afficher {resultCount} objet{resultCount > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
