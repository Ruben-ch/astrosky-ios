/**
 * Surcouches du mode Caméra AR : flux vidéo arrière plein cadre (filtres de
 * visibilité et de vision nocturne rouge), barre d'outils terrain (calage de la
 * boussole, renfort de visibilité, photo annotée), alerte caméra et aperçu photo.
 */
import { Aperture, CameraOff, Compass, Download, Sun, SunDim, X } from 'lucide-react'
import type { RefObject } from 'react'
import { formatOffset } from '../../services/sky/arCamera'
import { arVideoFilter } from '../../services/sky/arImage'
import type { ArCameraStatus } from './useArCamera'

const glass = 'bg-bg-primary/65 shadow-lg shadow-black/40 backdrop-blur-xl'

export function ArVideo({ videoRef, boost, redNight }: { videoRef: RefObject<HTMLVideoElement | null>; boost: boolean; redNight: boolean }) {
  return (
    <video
      ref={videoRef}
      data-ar-video
      playsInline
      muted
      autoPlay
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
      // Le style en ligne remplace le filtre générique des médias en red-night.
      style={{ filter: arVideoFilter(boost, redNight) }}
    />
  )
}

interface ToolbarProps {
  offsetDeg: number
  calibrating: boolean
  boost: boolean
  busy: boolean
  onResetOffset(): void
  onToggleBoost(): void
  onCapture(): void
}

export function ArToolbar({ offsetDeg, calibrating, boost, busy, onResetOffset, onToggleBoost, onCapture }: ToolbarProps) {
  return (
    <div data-sky-hud className={`pointer-events-auto mx-auto flex w-fit items-center gap-0.5 rounded-full p-1 ${glass}`} role="toolbar" aria-label="Outils de la caméra AR">
      <span className={`flex h-11 items-center gap-1.5 pr-1 pl-3 text-[12px] font-semibold tabular-nums ${calibrating ? 'text-primary' : 'text-tertiary'}`} aria-live="polite">
        <Compass size={14} aria-hidden />
        {formatOffset(offsetDeg)}
      </span>
      <button
        type="button"
        onClick={onResetOffset}
        disabled={Math.round(offsetDeg) === 0}
        aria-label="Réinitialiser le calage de la boussole"
        className="touch-target flex items-center justify-center rounded-full text-[12px] font-bold text-accent disabled:text-tertiary"
      >
        0°
      </button>
      <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />
      <button
        type="button"
        onClick={onToggleBoost}
        aria-pressed={boost}
        aria-label="Visibilité : éclaircir le flux vidéo"
        className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${boost ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
      >
        {boost ? <Sun size={15} aria-hidden /> : <SunDim size={15} aria-hidden />}
        Visibilité
      </button>
      <button type="button" onClick={onCapture} disabled={busy} aria-label="Photo AR annotée" className="touch-target flex items-center justify-center rounded-full text-primary disabled:opacity-50">
        <Aperture size={20} className={busy ? 'animate-spin' : ''} aria-hidden />
      </button>
    </div>
  )
}

const ERROR_TEXT: Record<'denied' | 'unavailable' | 'failed', string> = {
  denied: 'Accès à la caméra refusé. Autorisez AstroSky dans Réglages › Confidentialité › Caméra pour superposer le ciel sur l’image réelle.',
  unavailable: 'Aucune caméra arrière disponible sur cet appareil.',
  failed: 'La caméra n’a pas pu démarrer (utilisée par une autre app ?).',
}

export function ArCameraAlert({ status, onSensors, onRetry }: { status: ArCameraStatus; onSensors(): void; onRetry(): void }) {
  if (status !== 'denied' && status !== 'unavailable' && status !== 'failed') return null
  return (
    <div data-sky-hud className="pointer-events-auto mx-auto max-w-sm rounded-3xl bg-elevated/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" role="alert">
      <div className="flex items-start gap-3">
        <CameraOff size={20} className="mt-0.5 shrink-0 text-fair" aria-hidden />
        <p className="text-[13px] leading-snug text-primary">{ERROR_TEXT[status]}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSensors} className="flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-accent-soft text-[13px] font-semibold text-accent">
          Passer en mode Capteurs
        </button>
        {status !== 'unavailable' && (
          <button type="button" onClick={onRetry} className="flex min-h-11 items-center justify-center rounded-2xl bg-softer px-4 text-[13px] font-semibold text-primary">
            Réessayer
          </button>
        )}
      </div>
    </div>
  )
}

/** Aperçu de la photo quand la feuille de partage n'est pas disponible (appui long → Enregistrer). */
export function ArSnapshotPreview({ url, name, onClose }: { url: string; name: string; onClose(): void }) {
  return (
    <div className="pt-safe pb-safe absolute inset-0 z-40 flex flex-col bg-bg-primary/95" role="dialog" aria-modal="true" aria-label="Photo AR annotée">
      <div className="flex items-center justify-between px-3 py-2">
        <a href={url} download={name} className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-4 text-[13px] font-semibold text-accent">
          <Download size={15} aria-hidden /> Enregistrer
        </a>
        <button type="button" onClick={onClose} aria-label="Fermer la photo" className="touch-target flex items-center justify-center rounded-full bg-softer text-primary">
          <X size={18} />
        </button>
      </div>
      <img src={url} alt="Photo du ciel annotée" className="min-h-0 flex-1 object-contain" style={{ WebkitTouchCallout: 'default', filter: 'none' }} />
      <p className="px-4 py-2 text-center text-[12px] text-tertiary">Appui long sur l’image pour l’enregistrer dans Photos.</p>
    </div>
  )
}
