/**
 * Sélecteur horizontal des astres (alternative accessible au toucher dans la
 * scène) : un toucher sélectionne et affiche la télémétrie, un second toucher
 * sur l'astre déjà sélectionné le centre dans la vue.
 */
import { useEffect, useRef } from 'react'
import { ORRERY_BODIES, ORRERY_NAME_FR } from '../../data/solarSystemPhysical'
import type { OrreryBodyId } from '../../types/orrery'

interface Props {
  selected: OrreryBodyId | null
  focused: OrreryBodyId | null
  onPick(id: OrreryBodyId): void
}

export function BodyStrip({ selected, focused, onPick }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selected) return
    scroller.current?.querySelector<HTMLElement>(`[data-body="${selected}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selected])
  return (
    <div
      ref={scroller}
      data-h-scroll
      data-orrery-hud
      className="no-scrollbar pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3"
      role="listbox"
      aria-label="Astres du système solaire"
      aria-orientation="horizontal"
    >
      {ORRERY_BODIES.map((id) => {
        const sel = id === selected
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={sel}
            data-body={id}
            onClick={() => onPick(id)}
            aria-label={sel ? `Centrer ${ORRERY_NAME_FR[id]}` : `Sélectionner ${ORRERY_NAME_FR[id]}`}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium backdrop-blur-xl transition-colors active:scale-[0.97] ${
              sel ? 'bg-accent-soft text-accent' : 'bg-elevated/70 text-primary'
            }`}
          >
            {focused === id && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
            {ORRERY_NAME_FR[id]}
          </button>
        )
      })}
    </div>
  )
}
