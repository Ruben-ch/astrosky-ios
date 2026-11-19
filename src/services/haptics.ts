/**
 * Retours haptiques iOS (Taptic Engine) via @capacitor/haptics.
 * Fallback silencieux sur navigateur : aucune exception ne remonte à l'UI.
 * Les crans de molette sont limités à ~30 Hz pour ne pas saturer le moteur.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const TICK_MIN_INTERVAL_MS = 33
let lastTickMs = 0

const native = () => Capacitor.isNativePlatform()

async function safe(fn: () => Promise<void>): Promise<void> {
  if (!native()) return
  try {
    await fn()
  } catch {
    /* plugin indisponible : on reste silencieux */
  }
}

/** Cran de molette temporelle (sélection discrète). */
export function hapticTick(nowMs: number = performance.now()): Promise<void> {
  if (nowMs - lastTickMs < TICK_MIN_INTERVAL_MS) return Promise.resolve()
  lastTickMs = nowMs
  return safe(() => Haptics.selectionChanged())
}

/** Changement d'onglet ou de mode. */
export function hapticSelection(): Promise<void> {
  return safe(() => Haptics.impact({ style: ImpactStyle.Light }))
}

/** Verrouillage d'une cible dans le ciel. */
export function hapticLock(): Promise<void> {
  return safe(() => Haptics.impact({ style: ImpactStyle.Medium }))
}

/** Action confirmée (position GPS acquise, données rafraîchies). */
export function hapticSuccess(): Promise<void> {
  return safe(() => Haptics.notification({ type: NotificationType.Success }))
}

/** Échec (permission refusée, réseau absent). */
export function hapticWarning(): Promise<void> {
  return safe(() => Haptics.notification({ type: NotificationType.Warning }))
}
