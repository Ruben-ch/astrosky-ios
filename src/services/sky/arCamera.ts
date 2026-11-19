/**
 * Mode Caméra AR du planétarium (calculs purs + session vidéo, sans React) :
 * - champ optique de l'objectif 1× de l'iPhone (65° par défaut, pincement 40–85°) ;
 * - recalage manuel de la boussole (`azimuthOffsetDeg`) par glissement horizontal :
 *   les magnétomètres dévient de 5 à 15° près d'un balcon ou d'un bâtiment ;
 * - session `getUserMedia` caméra arrière avec arrêt strict de toutes les pistes
 *   (voyant caméra éteint) à la sortie du mode, au changement d'onglet ou en arrière-plan.
 */
import type { SkyView } from '../../types/sky'
import { DEG, wrap360 } from './vector'

/** Champ horizontal par défaut : objectif grand-angle 1× de l'iPhone, degrés. */
export const AR_DEFAULT_FOV_DEG = 65
export const AR_MIN_FOV_DEG = 40
export const AR_MAX_FOV_DEG = 85
/** Recalage maximal autorisé de part et d'autre du cap boussole, degrés. */
export const AR_MAX_OFFSET_DEG = 45

export const AR_VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
}

export const clampArFov = (fovDeg: number) => Math.min(AR_MAX_FOV_DEG, Math.max(AR_MIN_FOV_DEG, fovDeg))

/** Décalage ramené dans [−180, 180) puis borné à ±AR_MAX_OFFSET_DEG. */
export function normalizeOffsetDeg(offsetDeg: number): number {
  const wrapped = ((((offsetDeg + 180) % 360) + 360) % 360) - 180
  return Math.max(-AR_MAX_OFFSET_DEG, Math.min(AR_MAX_OFFSET_DEG, wrapped))
}

/**
 * Angle horizontal (degrés) balayé par un glissement de `dxPx` en projection
 * gnomonique centrée : focale f = (L/2) / tan(champ/2), angle = atan(dx / f).
 */
export function dragAngleDeg(dxPx: number, widthPx: number, fovDeg: number): number {
  if (widthPx <= 0) return 0
  const focalPx = widthPx / 2 / Math.tan((fovDeg / 2) * DEG)
  return Math.atan(dxPx / focalPx) / DEG
}

/**
 * Nouveau calage après un glissement horizontal : faire glisser la carte vers la
 * droite déplace les astres vers la droite, donc l'azimut de visée diminue.
 */
export function offsetAfterDrag(offsetDeg: number, dxPx: number, widthPx: number, fovDeg: number): number {
  return normalizeOffsetDeg(offsetDeg - dragAngleDeg(dxPx, widthPx, fovDeg))
}

/** Vue capteurs corrigée du calage boussole. */
export function applyAzimuthOffset(view: SkyView, offsetDeg: number): SkyView {
  return { ...view, azimuthDeg: wrap360(view.azimuthDeg + offsetDeg) }
}

/** Libellé compact du badge : « Calage +6° », « Calage −3° », « Calage 0° ». */
export function formatOffset(offsetDeg: number): string {
  const r = Math.round(offsetDeg)
  return `Calage ${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}°`
}

export type ArCameraError = 'denied' | 'unavailable' | 'failed'

/** Classe une erreur `getUserMedia` : refus de l'utilisateur, capteur absent, ou autre. */
export function classifyCameraError(error: unknown): ArCameraError {
  const name = (error as { name?: string } | null)?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError' || name === 'NotReadableError') return 'unavailable'
  return 'failed'
}

/** Arrête toutes les pistes d'un flux (voyant caméra éteint). */
export function stopStream(stream: MediaStream | null | undefined): void {
  for (const t of stream?.getTracks() ?? []) t.stop()
}

type MediaDevicesLike = Pick<MediaDevices, 'getUserMedia'>

/**
 * Session caméra arrière. `start` est idempotent ; `stop` arrête toutes les
 * pistes, y compris celles d'une demande encore en cours (flux arrivé après l'arrêt).
 */
export class ArCameraSession {
  private stream: MediaStream | null = null
  private generation = 0
  private readonly devices: () => MediaDevicesLike | undefined

  constructor(devices: () => MediaDevicesLike | undefined = () => globalThis.navigator?.mediaDevices) {
    this.devices = devices
  }

  get active(): boolean {
    return this.stream !== null && this.stream.getTracks().some((t) => t.readyState === 'live')
  }

  get current(): MediaStream | null {
    return this.stream
  }

  /** Ouvre la caméra arrière ; lève une `ArCameraError` typée (`denied`, `unavailable`, `failed`). */
  async start(): Promise<MediaStream> {
    if (this.stream && this.active) return this.stream
    const md = this.devices()
    if (!md?.getUserMedia) throw Object.assign(new Error('Caméra indisponible'), { reason: 'unavailable' as ArCameraError })
    const gen = ++this.generation
    let stream: MediaStream
    try {
      stream = await md.getUserMedia(AR_VIDEO_CONSTRAINTS)
    } catch (e) {
      throw Object.assign(new Error('Caméra refusée ou indisponible'), { reason: classifyCameraError(e) })
    }
    // Arrêt demandé pendant l'attente de l'autorisation : le flux est éteint aussitôt.
    if (gen !== this.generation) {
      stopStream(stream)
      throw Object.assign(new Error('Session caméra annulée'), { reason: 'failed' as ArCameraError, cancelled: true })
    }
    this.stream = stream
    return stream
  }

  stop(): void {
    this.generation++
    stopStream(this.stream)
    this.stream = null
  }
}

export const cameraErrorReason = (e: unknown): ArCameraError => (e as { reason?: ArCameraError })?.reason ?? classifyCameraError(e)
export const isCancelled = (e: unknown): boolean => (e as { cancelled?: boolean })?.cancelled === true
