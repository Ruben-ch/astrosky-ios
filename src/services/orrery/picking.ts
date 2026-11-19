/**
 * Sélection d'un astre au toucher et reconnaissance des tapes (simple / double)
 * dans le Système Solaire 3D. Les astres projetés à l'écran sont comparés en
 * pixels CSS : un disque minuscule reste touchable grâce à un rayon de capture
 * d'au moins 22 px (cible tactile de 44 px).
 */
import type { OrreryBodyId, ScreenPick } from '../../types/orrery'

/** Rayon de capture minimal autour d'un astre, en px CSS. */
export const MIN_PICK_RADIUS_PX = 22
/** Délai maximal entre deux tapes d'un double-tap, en ms. */
export const DOUBLE_TAP_MS = 320
/** Écart maximal entre deux tapes d'un double-tap, en px CSS. */
export const DOUBLE_TAP_SLOP_PX = 32
/** Déplacement maximal pour qu'un contact compte comme une tape, en px CSS. */
export const TAP_SLOP_PX = 8

/**
 * Astre le plus proche du point touché parmi ceux dont la zone de capture le
 * contient. Les distances sont normalisées par la zone de capture, puis la
 * profondeur départage les astres quasi superposés (le plus proche de l'œil gagne).
 */
export function pickBody(picks: readonly ScreenPick[], x: number, y: number): OrreryBodyId | null {
  let best: ScreenPick | null = null
  let bestScore = Infinity
  for (const p of picks) {
    const capture = Math.max(MIN_PICK_RADIUS_PX, p.radiusPx + 10)
    const d = Math.hypot(p.x - x, p.y - y)
    if (d > capture) continue
    // Un toucher dans le disque visible vaut 0 : priorité au disque réellement touché.
    const score = Math.max(0, d - p.radiusPx) / capture
    if (score < bestScore - 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && best !== null && p.depth < best.depth)) {
      best = p
      bestScore = score
    }
  }
  return best?.id ?? null
}

export interface TapRecord {
  readonly timeMs: number
  readonly x: number
  readonly y: number
}

/** Une tape est-elle la seconde d'un double-tap ? */
export function isDoubleTap(previous: TapRecord | null, current: TapRecord): boolean {
  if (!previous) return false
  const dt = current.timeMs - previous.timeMs
  return dt >= 0 && dt <= DOUBLE_TAP_MS && Math.hypot(current.x - previous.x, current.y - previous.y) <= DOUBLE_TAP_SLOP_PX
}
