/**
 * Surcouches du Système Solaire 3D : choix de la vue (écliptique / polaire),
 * bascules orbites / étiquettes / suivi, recentrage sur le Soleil et zoom.
 */
import { Crosshair, Minus, Orbit, Plus, Sun, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrreryViewMode } from '../../types/orrery'

const glass = 'bg-bg-primary/65 shadow-lg shadow-black/40 backdrop-blur-xl'

interface TopProps {
  viewMode: OrreryViewMode
  showOrbits: boolean
  showLabels: boolean
  follow: boolean
  onViewMode(mode: OrreryViewMode): void
  onToggle(key: 'showOrbits' | 'showLabels' | 'follow'): void
  onRecenter(): void
}

function Toggle({ on, label, icon: Icon, onClick }: { on: boolean; label: string; icon: LucideIcon; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`touch-target flex items-center justify-center rounded-full ${on ? 'text-accent' : 'text-tertiary'}`}
    >
      <Icon size={18} aria-hidden />
    </button>
  )
}

export function OrreryTopBar({ viewMode, showOrbits, showLabels, follow, onViewMode, onToggle, onRecenter }: TopProps) {
  const modes: { id: OrreryViewMode; label: string }[] = [
    { id: 'ecliptic', label: 'Écliptique' },
    { id: 'polar', label: 'Polaire' },
  ]
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-2">
      <div data-orrery-hud className={`pointer-events-auto grid grid-cols-2 gap-0.5 rounded-full p-1 ${glass}`} role="radiogroup" aria-label="Vue de la caméra">
        {modes.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={viewMode === id}
            onClick={() => onViewMode(id)}
            className={`flex min-h-11 items-center justify-center rounded-full px-3 text-[12px] font-semibold ${viewMode === id ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div data-orrery-hud className={`pointer-events-auto flex items-center rounded-full p-1 ${glass}`} role="group" aria-label="Affichage">
        <Toggle on={showOrbits} label="Orbites et grille de l’écliptique" icon={Orbit} onClick={() => onToggle('showOrbits')} />
        <Toggle on={showLabels} label="Noms des astres" icon={Tag} onClick={() => onToggle('showLabels')} />
        <Toggle on={follow} label="Suivre l’astre centré" icon={Crosshair} onClick={() => onToggle('follow')} />
        <button type="button" onClick={onRecenter} aria-label="Vue d’ensemble centrée sur le Soleil" className="touch-target flex items-center justify-center rounded-full text-primary">
          <Sun size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function OrreryZoomControls({ onZoom }: { onZoom(factor: number): void }) {
  return (
    <div data-orrery-hud className={`absolute top-[72px] right-3 z-10 flex flex-col overflow-hidden rounded-full ${glass}`}>
      <button type="button" onClick={() => onZoom(1 / 1.6)} aria-label="Zoomer" className="touch-target flex items-center justify-center border-b border-hairline text-primary">
        <Plus size={20} />
      </button>
      <button type="button" onClick={() => onZoom(1.6)} aria-label="Dézoomer" className="touch-target flex items-center justify-center text-primary">
        <Minus size={20} />
      </button>
    </div>
  )
}
