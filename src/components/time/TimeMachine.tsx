/**
 * Machine à voyager dans le temps : pilule flottante discrète au-dessus de la
 * barre d'onglets (« 22:00 · Direct », badge ambre en pause ou en simulation),
 * dépliable en panneau complet : lecture/pause, retour au direct, molette,
 * sauts vers les évènements, pas calendaires, vitesses et date absolue.
 */
import { CalendarClock, ChevronDown, Pause, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useObserver, useSimulation } from '../../hooks/useAppContext'
import { useClockReadout } from '../../hooks/useSimTime'
import { getSunGeometricAltitudeDeg, phaseForSunAltitude } from '../../services/astroEngine'
import type { TwilightPhase } from '../../types/tonight'
import { hapticSelection } from '../../services/haptics'
import { SIMULATION_RATES, formatOffset, formatRate, isLive } from '../../services/simulationClock'
import { fmtDay, fmtTime, fmtTimeSec, toDatetimeLocal } from '../ui/format'
import { ScrubWheel } from '../ui/ScrubWheel'
import { TimeJumpsRow } from './TimeJumpsRow'
import { TimeStepper } from './TimeStepper'

const PHASE_SHORT: Record<TwilightPhase, string> = { day: 'Jour', civil: 'Civil', nautical: 'Nautique', astronomical: 'Astro', night: 'Nuit noire' }

function usePhaseLabel(simMs: number): string {
  const { location } = useObserver()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  const minuteMs = Math.floor(simMs / 60_000) * 60_000
  return useMemo(() => {
    const alt = getSunGeometricAltitudeDeg(new Date(minuteMs), { latitudeDeg, longitudeDeg, elevationM })
    return PHASE_SHORT[phaseForSunAltitude(alt)]
  }, [minuteMs, latitudeDeg, longitudeDeg, elevationM])
}

export function TimeMachine() {
  const sim = useSimulation()
  const { simMs, realMs } = useClockReadout(250)
  const now = new Date(simMs)
  const [open, setOpen] = useState(false)
  const live = isLive(sim.anchor, realMs)
  const paused = sim.rate === 0
  const offset = simMs - Math.floor(realMs / 1000) * 1000
  const phase = usePhaseLabel(simMs)
  const status = live ? 'temps réel' : sim.rate === 1 ? formatOffset(offset) : `${formatOffset(offset)} · ${formatRate(sim.rate)}`
  const pillTag = paused ? 'Pause' : live ? 'Direct' : sim.rate === 1 ? formatOffset(offset) : formatRate(sim.rate)
  const sameDay = new Date(realMs).toDateString() === now.toDateString()

  const toggle = () => {
    setOpen((o) => !o)
    void hapticSelection()
  }
  const togglePause = () => {
    sim.setRate(paused ? 1 : 0)
    void hapticSelection()
  }
  const goLive = () => {
    sim.goLive()
    void hapticSelection()
  }

  if (!open) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center px-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          aria-label={`Déplier la machine temporelle : ${fmtTime(now)}, ${pillTag}`}
          className="pointer-events-auto flex min-h-11 items-center"
        >
          <span
            className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold tabular-nums shadow-lg shadow-black/60 backdrop-blur-xl ${
              live && !paused ? 'bg-elevated/95 text-primary' : 'bg-elevated/95 text-gold ring-1 ring-gold/45'
            }`}
          >
            {live && !paused ? <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> : paused ? <Pause size={12} aria-hidden /> : <CalendarClock size={13} aria-hidden />}
            {!sameDay && <span className="font-medium">{fmtDay(now)}</span>}
            <span>{fmtTime(now)}</span>
            <span className="opacity-60">·</span>
            <span className={live && !paused ? 'text-accent' : ''}>{pillTag}</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="absolute inset-0 z-20 bg-bg-primary/50" onClick={toggle} aria-hidden />
      <div className="absolute inset-x-2 bottom-2 z-30 rounded-[26px] bg-elevated/95 px-4 pt-2 pb-3 shadow-2xl shadow-black backdrop-blur-xl" role="group" aria-label="Machine temporelle">
        <div className="flex min-h-14 items-center gap-2">
          <button type="button" onClick={toggle} aria-expanded aria-label="Replier la machine temporelle" className="touch-target flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-[22px] leading-tight font-semibold tabular-nums">{fmtTimeSec(now)}</span>
                <span className="truncate text-[12px] font-semibold text-accent">{phase}</span>
              </span>
              <span className={`block truncate text-[12px] tabular-nums ${live ? 'text-secondary' : 'text-gold'}`}>
                {fmtDay(now)} · {status}
              </span>
            </span>
            <ChevronDown size={18} className="ml-auto shrink-0 text-secondary" aria-hidden />
          </button>
          <button type="button" onClick={togglePause} aria-label={paused ? 'Reprendre' : 'Mettre en pause'} className="touch-target flex items-center justify-center rounded-full bg-softer text-primary">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            type="button"
            onClick={goLive}
            disabled={live}
            className={`touch-target flex shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold ${live ? 'bg-softer text-accent' : 'bg-accent-soft text-accent'}`}
          >
            {live ? <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> : <RotateCcw size={14} aria-hidden />}
            Direct
          </button>
        </div>

        <div className="no-scrollbar max-h-[52dvh] space-y-3 overflow-y-auto pt-1">
          <ScrubWheel />
          <TimeJumpsRow simMs={simMs} />
          <TimeStepper />
          <div data-h-scroll className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Vitesse de simulation">
            {SIMULATION_RATES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={sim.rate === r}
                onClick={() => {
                  sim.setRate(r)
                  void hapticSelection()
                }}
                className={`touch-target flex shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap tabular-nums active:scale-[0.97] ${
                  sim.rate === r ? 'bg-accent-soft text-accent' : 'bg-soft text-secondary'
                }`}
              >
                {formatRate(r)}
              </button>
            ))}
          </div>
          <label className="relative flex min-h-11 items-center gap-3 rounded-2xl bg-soft px-3">
            <span className="text-[12px] text-secondary">Aller au</span>
            <input
              type="datetime-local"
              value={toDatetimeLocal(now)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime()
                if (Number.isFinite(t)) sim.jumpTo(t)
              }}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-right text-[15px] tabular-nums outline-none"
            />
            <CalendarClock size={16} className="pointer-events-none text-accent" aria-hidden />
          </label>
        </div>
      </div>
    </>
  )
}
