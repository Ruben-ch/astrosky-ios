/**
 * Carte « Crépuscules » : frise interactive (glisser pour voyager dans la nuit,
 * cran haptique à chaque changement de phase), phase courante, compte à rebours
 * et horaires exacts du soir et du matin (touchables pour y sauter).
 */
import { Sunset } from 'lucide-react'
import { useRef } from 'react'
import { useHiDpiCanvas } from '../../hooks/useHiDpiCanvas'
import { useSimulation, useTheme } from '../../hooks/useAppContext'
import { TWILIGHT_PHASE_FR, nextTransition, segmentAt } from '../../services/astroEngine'
import { hapticSelection, hapticTick } from '../../services/haptics'
import type { NightTimeline, TwilightTransition } from '../../types/tonight'
import { Card } from '../ui/Card'
import { fmtDuration, fmtRelative, fmtTime } from '../ui/format'
import { TIMELINE_HEIGHT, drawTimeline, timeAtX } from './twilightDraw'

const SHORT: Record<string, string> = {
  'Coucher du Soleil': 'Coucher', 'Fin du crépuscule civil': 'Civil', 'Fin du crépuscule nautique': 'Nautique',
  'Début de la nuit noire': 'Astro', 'Aube astronomique': 'Astro', 'Aube nautique': 'Nautique', 'Aube civile': 'Civil',
  'Lever du Soleil': 'Lever',
}

function TransitionGrid({ title, items, nowMs, nextKey, onJump }: { title: string; items: TwilightTransition[]; nowMs: number; nextKey: string | null; onJump(t: TwilightTransition): void }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium text-tertiary">{title}</div>
      <div className="-mx-1.5 grid grid-cols-4">
        {items.map((t) => {
          const past = t.time.getTime() < nowMs
          const next = t.label === nextKey
          const dark = t.phase === 'night' || (t.phase === 'astronomical' && !t.evening)
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => onJump(t)}
              aria-label={`Aller à : ${t.label}, ${fmtTime(t.time)}`}
              className={`min-h-11 rounded-xl px-1.5 py-1.5 text-left transition-colors active:scale-[0.97] ${next ? 'bg-accent-soft' : ''}`}
            >
              <span className={`block truncate text-[11px] ${next ? 'text-accent' : 'text-tertiary'}`}>{SHORT[t.label] ?? t.label}</span>
              <span className={`block text-[16px] font-medium tabular-nums ${next ? 'text-accent' : past ? 'text-tertiary' : dark ? 'text-primary' : 'text-secondary'}`}>{fmtTime(t.time)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TwilightTimelineCard({ timeline, now }: { timeline: NightTimeline; now: Date }) {
  const { palette: p } = useTheme()
  const sim = useSimulation()
  const nowMs = now.getTime()
  const dragPhase = useRef<string | null>(null)
  const ref = useHiDpiCanvas(
    (ctx, { width }) => {
      drawTimeline(ctx, width, timeline, nowMs, p)
    },
    [timeline, nowMs, p],
  )

  const scrubTo = (clientX: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect()
    const t = timeAtX(clientX - rect.left, rect.width, timeline)
    sim.jumpTo(t)
    const phase = segmentAt(timeline, new Date(t))?.phase ?? null
    if (phase !== dragPhase.current) {
      dragPhase.current = phase
      void hapticSelection()
    } else void hapticTick()
  }

  const current = segmentAt(timeline, now)
  const next = nextTransition(timeline, now)
  const night = timeline.segments.filter((s) => s.phase === 'night').reduce((m, s) => m + (s.end.getTime() - s.start.getTime()) / 60_000, 0)
  const jump = (t: TwilightTransition) => {
    sim.jumpTo(t.time.getTime())
    void hapticSelection()
  }

  return (
    <Card title="Crépuscules" icon={<Sunset size={15} />} aside={<span className="text-[12px] text-secondary tabular-nums">nuit noire {fmtDuration(night)}</span>}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[26px] leading-tight font-semibold tracking-tight">{current ? TWILIGHT_PHASE_FR[current.phase] : '—'}</div>
          {next && (
            <div className="mt-0.5 text-[13px] text-secondary tabular-nums">
              {next.label} <span className="font-medium text-accent">{fmtRelative(next.time, now)}</span>
            </div>
          )}
        </div>
        {next && <div className="shrink-0 text-right text-[22px] font-medium text-primary tabular-nums">{fmtTime(next.time)}</div>}
      </div>
      <canvas
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Frise de la nuit : glisser pour voyager dans le temps"
        aria-valuetext={`${fmtTime(now)} · ${current ? TWILIGHT_PHASE_FR[current.phase] : ''}`}
        style={{ height: TIMELINE_HEIGHT }}
        className="mt-4 block w-full touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dragPhase.current = current?.phase ?? null
          scrubTo(e.clientX, e.currentTarget)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX, e.currentTarget)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') sim.shiftBy(15 * 60_000)
          if (e.key === 'ArrowLeft') sim.shiftBy(-15 * 60_000)
        }}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full" style={{ background: p.chart.moonUp }} aria-hidden />Lune levée</span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <span className="h-1 w-3 rounded-full" style={{ background: p.chart.moonlessDark }} aria-hidden />Nuit noire sans Lune · {fmtDuration(timeline.moonlessDarkMinutes)}
        </span>
      </div>
      <div className="mt-5 space-y-3 border-t border-hairline pt-4">
        <TransitionGrid title="Soir" items={timeline.transitions.filter((t) => t.evening)} nowMs={nowMs} nextKey={next?.label ?? null} onJump={jump} />
        <TransitionGrid title="Matin" items={timeline.transitions.filter((t) => !t.evening)} nowMs={nowMs} nextKey={next?.label ?? null} onJump={jump} />
      </div>
    </Card>
  )
}
