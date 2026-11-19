/**
 * Surcouches du planétarium : mode de pilotage (Tactile / Capteurs), relevé du
 * centre de vue (azimut, hauteur, champ), projection, couches, plein écran et zoom.
 */
import { Camera, Compass, Hand, Layers, Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
import { azimuthToCardinal } from '../../services/astroEngine'
import { hapticSelection } from '../../services/haptics'
import type { SensorStatus } from './useOrientationControl'
import type { ProjectionKind, SkyControlMode, SkyView } from '../../types/sky'
import { fmtNumber } from '../ui/format'

const glass = 'bg-bg-primary/65 shadow-lg shadow-black/40 backdrop-blur-xl'

interface TopProps {
  mode: SkyControlMode
  sensorStatus: SensorStatus
  projection: ProjectionKind
  immersive: boolean
  onMode(mode: SkyControlMode): void
  onProjection(p: ProjectionKind): void
  onLayers(): void
  onImmersive(): void
}

export function SkyTopBar({ mode, sensorStatus, projection, immersive, onMode, onProjection, onLayers, onImmersive }: TopProps) {
  const modes: { id: SkyControlMode; label: string; aria: string; icon: typeof Hand }[] = [
    { id: 'touch', label: 'Tactile', aria: 'Tactile', icon: Hand },
    { id: 'sensors', label: 'Capteurs', aria: 'Capteurs', icon: Compass },
    { id: 'ar', label: 'AR', aria: 'AR · caméra', icon: Camera },
  ]
  const icon = 'touch-target flex items-center justify-center rounded-full'
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3 ${immersive ? 'pt-[max(env(safe-area-inset-top),8px)]' : 'pt-2'}`}>
      <div data-sky-hud className={`pointer-events-auto flex items-center gap-0.5 rounded-full p-1 ${glass}`}>
        <div className="flex gap-0.5" role="radiogroup" aria-label="Pilotage de la carte">
          {/* Libellé visible pour le mode actif seulement : trois états tiennent sur 393 px. */}
          {modes.map(({ id, label, aria, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              aria-label={aria}
              onClick={() => onMode(id)}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold ${mode === id ? 'bg-accent-soft px-3 text-accent' : 'px-2 text-secondary'}`}
            >
              <Icon size={16} className={id !== 'touch' && mode === id && sensorStatus === 'requesting' ? 'animate-pulse' : ''} aria-hidden />
              {mode === id && <span>{label}</span>}
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />
        <button type="button" onClick={onLayers} aria-label="Couches affichées" className={`${icon} text-primary`}>
          <Layers size={18} />
        </button>
        {mode !== 'ar' && <button
          type="button"
          onClick={() => {
            onProjection(projection === 'stereographic' ? 'equidistant' : 'stereographic')
            void hapticSelection()
          }}
          aria-label={`Projection ${projection === 'stereographic' ? 'stéréographique' : 'azimutale équidistante'} : changer`}
          className={`${icon} text-[11px] font-bold text-accent`}
        >
          {projection === 'stereographic' ? 'STÉ' : 'ÉQD'}
        </button>}
        <button
          type="button"
          onClick={onImmersive}
          aria-label={immersive ? 'Quitter le plein écran' : 'Plein écran'}
          aria-pressed={immersive}
          className={`${icon} ${immersive ? 'text-accent' : 'text-primary'}`}
        >
          {immersive ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </div>
  )
}

/** Télémétrie du centre de vue : petit badge discret en bas à gauche de la carte. */
export function SkyTelemetryBadge({ readout }: { readout: SkyView }) {
  return (
    <div data-sky-hud className="pointer-events-none flex h-7 w-fit items-center gap-2 rounded-full bg-bg-primary/60 px-2.5 text-[11px] text-secondary tabular-nums backdrop-blur-md" aria-live="off">
      <span>
        Az <span className="font-semibold text-primary">{fmtNumber(readout.azimuthDeg, 0)}°</span> {azimuthToCardinal(readout.azimuthDeg)}
      </span>
      <span>
        Haut <span className="font-semibold text-primary">{fmtNumber(readout.altitudeDeg, 0)}°</span>
      </span>
      <span>
        Champ <span className="font-semibold text-primary">{fmtNumber(readout.fovDeg, readout.fovDeg < 10 ? 1 : 0)}°</span>
      </span>
    </div>
  )
}

export function SkyZoomControls({ onZoom }: { onZoom(factor: number): void }) {
  return (
    <div data-sky-hud className={`absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-full ${glass}`}>
      <button type="button" onClick={() => onZoom(1.6)} aria-label="Zoomer" className="touch-target flex items-center justify-center border-b border-hairline text-primary">
        <Plus size={20} />
      </button>
      <button type="button" onClick={() => onZoom(1 / 1.6)} aria-label="Dézoomer" className="touch-target flex items-center justify-center text-primary">
        <Minus size={20} />
      </button>
    </div>
  )
}
