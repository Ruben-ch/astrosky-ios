/**
 * Carte « Saison idéale » : durée nocturne au-dessus de 30° mois par mois
 * (histogramme), mois recommandés, culmination à minuit et hauteur au méridien.
 */
import { CalendarRange } from 'lucide-react'
import { SEASON_SUN_LIMIT_DEG } from '../../../services/catalog/season'
import type { SeasonInfo } from '../../../types/encyclopedia'
import { Card, Readout } from '../../ui/Card'
import { fmtDuration, fmtNumber } from '../../ui/format'

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const monthName = (m: number) => new Date(Date.UTC(2026, m, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

function bestText(s: SeasonInfo): string {
  if (s.neverRises) return 'Jamais levé depuis ce site.'
  if (s.bestMonths.length === 0) return 'Jamais au-dessus de 30° en nuit sombre depuis ce site.'
  if (s.bestMonths.length >= 11) return 'Bien placé toute l’année depuis ce site.'
  const first = s.bestMonths[0]
  const last = s.bestMonths[s.bestMonths.length - 1]
  return first === last ? `Meilleur mois : ${monthName(first)}.` : `Meilleure période : de ${monthName(first)} à ${monthName(last)}.`
}

export function SeasonCard({ season: s, nowMonth }: { season: SeasonInfo; nowMonth: number }) {
  const max = Math.max(1, ...s.months.map((m) => m.darkMinutesAbove30))
  return (
    <Card title="Saison idéale" icon={<CalendarRange size={14} />}>
      <p className="mb-3 text-[14px] font-medium text-primary">{bestText(s)}</p>
      <div className="flex h-24 items-end gap-1" role="list" aria-label="Durée au-dessus de 30° en nuit sombre, par mois">
        {s.months.map((m) => {
          const best = s.bestMonths.includes(m.month)
          const h = (m.darkMinutesAbove30 / max) * 100
          return (
            <div key={m.month} role="listitem" aria-label={`${monthName(m.month)} : ${fmtDuration(m.darkMinutesAbove30)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className={`w-full rounded-t-sm ${best ? 'bg-accent' : 'bg-strong'}`}
                style={{ height: `${Math.max(m.darkMinutesAbove30 > 0 ? 4 : 1, h)}%`, opacity: best ? 1 : 0.7 }}
              />
              <span className={`text-[10px] tabular-nums ${m.month === nowMonth ? 'font-bold text-accent' : 'text-tertiary'}`}>{MONTHS_SHORT[m.month]}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Readout label="Minuit au méridien" value={s.midnightCulmination ? dateFmt.format(s.midnightCulmination) : '—'} />
        <Readout
          label="Hauteur au méridien"
          value={s.meridianAltitudeDeg > 0 ? `${fmtNumber(s.meridianAltitudeDeg, 0)}°` : '—'}
          unit={s.circumpolar ? 'circumpolaire' : undefined}
        />
      </div>
      <p className="mt-2 text-[11px] text-tertiary">
        Nuit du 15 de chaque mois, Soleil sous {fmtNumber(SEASON_SUN_LIMIT_DEG, 0)}° ; barres pleines : mois recommandés.
      </p>
    </Card>
  )
}
