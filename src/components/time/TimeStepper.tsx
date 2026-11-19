/** Pas temporels : choix de l'unité (minute → année) et boutons ±1 / ±5 unités. */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useState } from 'react'
import { useSimulation } from '../../hooks/useAppContext'
import { hapticSelection, hapticTick } from '../../services/haptics'
import { CALENDAR_UNITS, shiftCalendar, type CalendarUnit } from '../../services/simulationClock'

const UNIT_FR: Record<CalendarUnit, { short: string; one: string }> = {
  minute: { short: 'Min', one: 'min' },
  hour: { short: 'Heure', one: 'h' },
  day: { short: 'Jour', one: 'j' },
  week: { short: 'Sem.', one: 'sem.' },
  month: { short: 'Mois', one: 'mois' },
  year: { short: 'An', one: 'an' },
}

const STEPS = [
  { n: -5, icon: ChevronsLeft },
  { n: -1, icon: ChevronLeft },
  { n: 1, icon: ChevronRight },
  { n: 5, icon: ChevronsRight },
] as const

export function TimeStepper() {
  const sim = useSimulation()
  const [unit, setUnit] = useState<CalendarUnit>('hour')

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-6 gap-1 rounded-2xl bg-soft p-1" role="radiogroup" aria-label="Unité de pas">
        {CALENDAR_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={unit === u}
            onClick={() => {
              setUnit(u)
              void hapticSelection()
            }}
            className={`min-h-11 rounded-xl text-[12px] font-semibold ${unit === u ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
          >
            {UNIT_FR[u].short}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {STEPS.map(({ n, icon: Icon }) => {
          const label = `${n > 0 ? '+' : '−'}${Math.abs(n)} ${UNIT_FR[unit].one}`
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                sim.jumpTo(shiftCalendar(sim.getSimMs(), unit, n))
                void hapticTick()
              }}
              aria-label={`${n > 0 ? 'Avancer' : 'Reculer'} de ${Math.abs(n)} ${UNIT_FR[unit].one}`}
              className="flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-soft text-[13px] font-medium tabular-nums active:scale-[0.97]"
            >
              {n < 0 && <Icon size={15} className="text-accent" aria-hidden />}
              {label}
              {n > 0 && <Icon size={15} className="text-accent" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
