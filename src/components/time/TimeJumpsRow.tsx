/** Raccourcis vers les prochains évènements célestes (coucher, nuit noire, Lune…). */
import { useMemo } from 'react'
import { useObserver, useSimulation } from '../../hooks/useAppContext'
import { getTimeJumps } from '../../services/astroEngine'
import { hapticLock } from '../../services/haptics'
import { fmtDay, fmtTime } from '../ui/format'

export function TimeJumpsRow({ simMs }: { simMs: number }) {
  const sim = useSimulation()
  const { location } = useObserver()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  const minuteMs = Math.floor(simMs / 60_000) * 60_000
  const jumps = useMemo(
    () => getTimeJumps(new Date(minuteMs), { latitudeDeg, longitudeDeg, elevationM }),
    [minuteMs, latitudeDeg, longitudeDeg, elevationM],
  )
  const today = new Date(minuteMs).toDateString()

  return (
    <div data-h-scroll className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Aller au prochain évènement">
      {jumps.map((j) => (
        <button
          key={j.id}
          type="button"
          onClick={() => {
            sim.jumpTo(j.time.getTime())
            void hapticLock()
          }}
          aria-label={`Aller à : ${j.label}, ${fmtDay(j.time)} ${fmtTime(j.time)}`}
          className="flex min-h-11 shrink-0 flex-col items-start justify-center rounded-2xl bg-soft px-3 active:scale-[0.97]"
        >
          <span className="text-[12px] font-semibold whitespace-nowrap">{j.label}</span>
          <span className="text-[10px] whitespace-nowrap text-secondary tabular-nums">
            {j.time.toDateString() === today ? '' : `${fmtDay(j.time)} · `}
            {fmtTime(j.time)}
          </span>
        </button>
      ))}
    </div>
  )
}
