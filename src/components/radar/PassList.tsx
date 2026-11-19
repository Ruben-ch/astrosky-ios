/**
 * Liste des passages visibles sur 48 h, groupés par nuit, filtrables
 * (tous, ISS, Tiangong, autres satellites brillants).
 */
import { Fragment } from 'react'
import { countdownTo, formatCountdownShort } from '../../services/space/countdown'
import type { VisiblePass } from '../../types/orbital'
import { Chip } from '../ui/Controls'
import { fmtDay, fmtMag, fmtNumber, fmtTime } from '../ui/format'
import { filterPasses, passPhase, type PassFilter } from './spaceFormat'


const FILTERS: readonly { id: PassFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'iss', label: 'ISS' },
  { id: 'tiangong', label: 'Tiangong' },
  { id: 'bright', label: 'Brillants' },
]

interface Props {
  passes: readonly VisiblePass[]
  filter: PassFilter
  onFilter(f: PassFilter): void
  selectedId: string | null
  nowMs: number
  onSelect(p: VisiblePass): void
  /** Prédiction encore en cours : la liste vide n'est pas un résultat. */
  pending?: boolean
}

export function PassList({ passes, filter, onFilter, selectedId, nowMs, onSelect, pending = false }: Props) {
  const shown = filterPasses(passes, filter)
  // Regroupement par nuit (jour local du début de la portion visible).
  const groups: { day: string; passes: VisiblePass[] }[] = []
  for (const p of shown) {
    const day = fmtDay(p.visibleStart.time)
    if (groups.at(-1)?.day !== day) groups.push({ day, passes: [] })
    groups.at(-1)!.passes.push(p)
  }
  return (
    <section aria-label="Passages visibles sur 48 heures">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2" data-h-scroll role="radiogroup" aria-label="Filtrer les passages">
        {FILTERS.map((f) => (
          <Chip key={f.id} role="radio" active={filter === f.id} onToggle={() => onFilter(f.id)}>
            {f.label} <span className="opacity-70">{filterPasses(passes, f.id).length}</span>
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-secondary">
          {pending ? 'Recherche des passages visibles…' : 'Aucun passage visible pour ce filtre dans les 48 h.'}
        </p>
      ) : (
        <ul className="-mx-4">
          {groups.map(({ day, passes: dayPasses }) => (
            <Fragment key={day}>
              <li className="sticky top-0 bg-bg-primary px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase" aria-hidden>
                {day}
              </li>
              {dayPasses.map((p) => {
                const phase = passPhase(p, nowMs)
                const live = phase === 'visible'
                return (
                  <li key={p.id} className="border-b border-hairline">
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      aria-pressed={p.id === selectedId}
                      aria-label={`${p.name}, visible à ${fmtTime(p.visibleStart.time)}, hauteur ${Math.round(p.culmination.elevationDeg)}°${phase === 'over' ? ', terminé' : live ? ', en cours' : ''}`}
                      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${p.id === selectedId ? 'bg-elevated' : ''} ${phase === 'over' ? 'opacity-50' : ''}`}
                    >
                      <span className="w-12 shrink-0 text-[15px] font-semibold text-accent tabular-nums">{fmtTime(p.visibleStart.time)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{p.name}</span>
                        <span className="block truncate text-[11px] text-tertiary tabular-nums">
                          NORAD {p.noradId} · {fmtNumber(p.culmination.elevationDeg, 0)}° max · {Math.round(p.visibleDurationSec / 60)} min{p.shadowEntry ? ' · entre dans l’ombre' : ''}
                        </span>
                      </span>
                      <span className="w-[86px] shrink-0 text-right tabular-nums">
                        <span className="block text-[15px] font-semibold">{p.peakMagnitude !== null ? fmtMag(p.peakMagnitude) : '—'}</span>
                        <span className={`block truncate text-[10px] ${live ? 'text-good' : 'text-tertiary'}`}>
                          {live ? 'en cours' : phase === 'over' ? 'terminé' : formatCountdownShort(countdownTo(p.visibleStart.time.getTime(), nowMs))}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  )
}
