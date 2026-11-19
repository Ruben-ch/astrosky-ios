/**
 * Sous-écran « Image du jour » (NASA APOD) : navigation jour par jour, média
 * haute définition, explication scientifique, cache hors-ligne par date.
 */
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { useAsync } from '../../../hooks/useAsync'
import { useSimulation } from '../../../hooks/useAppContext'
import { hapticSelection } from '../../../services/haptics'
import { APOD_FIRST_DATE, clampApodDate, loadApod, nasaToday, shiftApodDate } from '../../../services/space/apod'
import { Badge } from '../../ui/Card'
import { ApodMedia } from './ApodMedia'

const ORIGIN_FR = { network: 'à jour', cache: 'en cache', 'stale-cache': 'cache périmé', bundled: 'image embarquée' } as const
const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function ApodPanel() {
  const { getSimMs } = useSimulation()
  // L'APOD suit le calendrier réel de la NASA : la date simulée est bornée au jour publié.
  const [today] = useState(() => nasaToday(Math.min(getSimMs(), Date.now())))
  const [date, setDate] = useState(today)
  const apod = useAsync(() => loadApod(date, { nowMs: Math.min(getSimMs(), Date.now()) }), [date])
  const go = (d: string) => {
    void hapticSelection()
    setDate(clampApodDate(d, Date.parse(`${today}T12:00:00Z`)))
  }
  const entry = apod.data?.entry
  const offline = apod.data?.origin === 'stale-cache' || apod.data?.origin === 'bundled'

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-2 rounded-[22px] bg-soft p-1" aria-label="Navigation entre les jours">
        <button type="button" onClick={() => go(shiftApodDate(date, -1))} disabled={date <= APOD_FIRST_DATE} aria-label="Jour précédent" className="flex size-11 items-center justify-center rounded-xl text-accent disabled:opacity-40">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase">
            <CalendarDays size={12} aria-hidden /> {date === today ? 'Image du jour' : 'Archive'}
          </div>
          <div className="truncate text-[14px] font-medium tabular-nums first-letter:uppercase" aria-live="polite">{longDate(date)}</div>
        </div>
        {date !== today ? (
          <button type="button" onClick={() => go(today)} aria-label="Revenir à l’image du jour" className="flex size-11 items-center justify-center rounded-xl text-secondary">
            <RotateCcw size={16} />
          </button>
        ) : null}
        <button type="button" onClick={() => go(shiftApodDate(date, 1))} disabled={date >= today} aria-label="Jour suivant" className="flex size-11 items-center justify-center rounded-xl text-accent disabled:opacity-40">
          <ChevronRight size={20} />
        </button>
      </nav>

      {apod.loading && !entry ? (
        <div className="aspect-[4/3] w-full animate-pulse rounded-[22px] bg-soft" aria-label="Chargement de l’image du jour" />
      ) : apod.error && !entry ? (
        <div className="rounded-[22px] bg-soft p-4 text-center" role="alert">
          <p className="text-[13px] text-secondary">Image du {longDate(date)} indisponible hors-ligne (jamais consultée).</p>
          <button type="button" onClick={apod.reload} className="mt-2 min-h-11 px-4 text-[14px] font-semibold text-accent">Réessayer</button>
        </div>
      ) : entry ? (
        <article className={`space-y-3 transition-opacity ${apod.loading ? 'opacity-60' : ''}`} aria-label={`Image astronomique du jour : ${entry.title}`}>
          <ApodMedia key={entry.date} entry={entry} />
          <header>
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-[20px] leading-tight font-semibold">{entry.title}</h2>
              <Badge tone={offline ? 'text-fair' : 'text-secondary'}>
                {offline && <WifiOff size={10} aria-hidden />}
                {ORIGIN_FR[apod.data!.origin]}
              </Badge>
            </div>
            <p className="mt-1 text-[12px] text-secondary tabular-nums">
              {entry.date !== date ? `Publication du ${longDate(entry.date)} (celle du jour n’est pas encore en ligne)` : longDate(entry.date)}
              {entry.copyright ? ` · © ${entry.copyright}` : ''}
            </p>
          </header>
          <p className="text-[14px] leading-relaxed text-primary">{entry.explanation}</p>
          <p className="pb-2 text-[11px] text-tertiary">Astronomy Picture of the Day — NASA. Explication originale en anglais.</p>
        </article>
      ) : null}
    </div>
  )
}
