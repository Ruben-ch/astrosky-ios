/**
 * Règles d'affichage du planétarium : magnitude limite selon le champ, taille
 * des étoiles, scintillation, pas de grille adaptatif, sélection au toucher.
 */
import type { SkyObjectRef } from '../../types/sky'

/** Magnitude limite affichée : 5 à 150° de champ, 6 (catalogue complet) sous 40°. */
export function limitingMagnitude(fovDeg: number): number {
  if (fovDeg <= 40) return 6
  return 6 - Math.min(1, (fovDeg - 40) / 110)
}

/**
 * Rayon d'une étoile (px CSS) : loi en 10^(−0,2·m) (flux^½), grossie quand on
 * zoome (le zoom révèle les étoiles), bornée pour rester fine et lisible.
 */
export function starRadiusPx(mag: number, fovDeg: number): number {
  const zoom = Math.min(2.2, Math.max(1, Math.sqrt(90 / fovDeg)))
  const r = 1.15 * Math.pow(10, -0.2 * (mag - 3)) * zoom
  return Math.min(6.5, Math.max(0.45, r))
}

/**
 * Scintillation 0,75–1,25 : plus forte près de l'horizon (masse d'air) et pour
 * les étoiles brillantes ; nulle au-dessus de 70° et pour les astres sous l'horizon.
 */
export function twinkleFactor(phaseRad: number, timeSec: number, altitudeDeg: number, mag: number): number {
  if (altitudeDeg <= 0 || altitudeDeg >= 70) return 1
  const airmass = 1 - altitudeDeg / 70
  const strength = 0.25 * airmass * (mag < 2.5 ? 1 : 0.6)
  const w = Math.sin(timeSec * 7.3 + phaseRad) * 0.6 + Math.sin(timeSec * 13.1 + phaseRad * 1.7) * 0.4
  return 1 + strength * w
}

/** Pas de grille (degrés) adapté au champ : ~6 à 10 lignes à l'écran. */
export function gridStepDeg(fovDeg: number): number {
  const steps = [1, 2, 5, 10, 15, 30]
  return steps.find((s) => fovDeg / s <= 10) ?? 30
}

export interface PickCandidate {
  readonly x: number
  readonly y: number
  readonly ref: SkyObjectRef
  /** 0 = prioritaire (Lune, planètes) → 3 (étoiles faibles). */
  readonly priority: number
}

/** Objet le plus proche du point touché dans `radiusPx`, priorité aux objets majeurs. */
export function pickNearest(candidates: readonly PickCandidate[], px: number, py: number, radiusPx = 26): SkyObjectRef | null {
  let best: PickCandidate | null = null
  let bestScore = Infinity
  for (const c of candidates) {
    const d = Math.hypot(c.x - px, c.y - py)
    if (d > radiusPx) continue
    // Chaque cran de priorité vaut 8 px de distance.
    const score = d + c.priority * 8
    if (score < bestScore) {
      best = c
      bestScore = score
    }
  }
  return best?.ref ?? null
}
