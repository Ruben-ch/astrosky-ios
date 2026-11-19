/** Cartes « Étoiles filantes » et « À venir » (calendrier des phénomènes). */
import { CalendarDays, Sparkles } from 'lucide-react'
import type { NightData } from '../../hooks/useNightData'
import type { AstroEventKind } from '../../types/astro'
import { Card } from '../ui/Card'
import { fmtDay, fmtNumber, fmtRelative, fmtTime } from '../ui/format'

export function MeteorCard({ data }: { data: NightData }) {
  const showers = data.summary.meteorShowers
  return (
    <Card title="Étoiles filantes" icon={<Sparkles size={15} />}>
      {showers.length === 0 ? (
        <p className="text-[13px] text-secondary">Aucun essaim majeur actif — activité sporadique (~5 météores/h).</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {showers.map((s) => (
            <li key={s.code} className="flex min-h-12 items-center gap-3 py-3">
              <span className="w-9 shrink-0 text-[11px] font-semibold tracking-wide text-accent">{s.code}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[15px] leading-snug font-medium">{s.name}</span>
                <span className="mt-0.5 block text-[12px] text-secondary tabular-nums">
                  max. {fmtDay(s.peak)} {fmtTime(s.peak)} · radiant {fmtNumber(s.radiantAltitudeDeg, 0)}°
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className="block text-[17px] font-semibold">{s.expectedHourlyRate < 0.5 ? '<1' : fmtNumber(s.expectedHourlyRate, 0)}</span>
                <span className="block text-[10px] text-tertiary">/h (ZHR {s.zhr})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const KIND_GLYPH: Record<AstroEventKind, string> = {
  'moon-phase': '☾',
  'lunar-eclipse': '◐',
  'solar-eclipse': '◑',
  'max-elongation': '∠',
  opposition: '☍',
  conjunction: '☌',
  'peak-magnitude': '✦',
  season: '☉',
  'meteor-shower': '✧',
  'lunar-apsis': '◎',
}

export function EventsCard({ data }: { data: NightData }) {
  const upcoming = data.events.filter((e) => e.time >= data.now).slice(0, 10)
  return (
    <Card title="À venir · 45 jours" icon={<CalendarDays size={15} />}>
      <ul className="divide-y divide-hairline">
        {upcoming.map((e) => (
          <li key={`${e.kind}-${e.time.getTime()}-${e.title}`} className="flex min-h-12 items-center gap-3 py-3">
            <span className="w-6 shrink-0 text-center text-[17px] text-accent" aria-hidden>{KIND_GLYPH[e.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] leading-snug font-medium">{e.title}</span>
              <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-secondary">{e.detail}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block text-[13px]">{fmtDay(e.time)}</span>
              <span className="block text-[11px] text-tertiary">{fmtRelative(e.time, data.now)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
