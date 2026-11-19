/**
 * Mode Guidage Cible : écart entre l'axe de visée et la cible, direction de la
 * flèche à l'écran, et suivi d'état avec hystérésis pour les retours haptiques
 * (impulsions de plus en plus rapprochées, verrouillage unique à l'arrivée).
 */
import type { GuidanceEvent, GuidanceReading, Vec3 } from '../../types/sky'
import type { ViewBasis } from './projection'
import { angleBetweenDeg, dot } from './vector'

/** Rayon de capture (degrés) : borné entre 1° et 5 % du champ, ≤ 4°. */
export function lockRadiusDeg(fovDeg: number): number {
  return Math.min(4, Math.max(1, fovDeg * 0.05))
}

/**
 * Lecture de guidage : écart angulaire et angle de la cible dans le plan de
 * l'écran (atan2 des composantes droite/haut : valable même derrière l'observateur).
 */
export function guidanceReading(basis: ViewBasis, target: Vec3): GuidanceReading {
  const x = dot(target, basis.r)
  const y = dot(target, basis.u)
  return { separationDeg: angleBetweenDeg(basis.f, target), screenAngleRad: Math.atan2(y, x), belowHorizon: target[2] < 0 }
}

/** Intervalle entre impulsions haptiques (ms) : 900 ms à ≥ 45°, 110 ms au contact. */
export function pulseIntervalMs(separationDeg: number, lockDeg: number): number {
  const t = Math.min(1, Math.max(0, (separationDeg - lockDeg) / (45 - lockDeg)))
  return Math.round(110 + (900 - 110) * Math.sqrt(t))
}

/** Suivi d'état du guidage (horloge injectée : testable et indépendant de React). */
export class GuidanceTracker {
  private locked = false
  private lastPulseMs = -Infinity

  /** Facteur d'hystérésis : on ne « décroche » qu'au-delà de 1,8 × le rayon de capture. */
  static readonly RELEASE_FACTOR = 1.8
  /** Au-delà, aucune impulsion (la cible est trop loin pour être utile). */
  static readonly PULSE_MAX_DEG = 60

  get isLocked(): boolean {
    return this.locked
  }

  reset(): void {
    this.locked = false
    this.lastPulseMs = -Infinity
  }

  update(separationDeg: number, lockDeg: number, nowMs: number): GuidanceEvent | null {
    if (!this.locked && separationDeg <= lockDeg) {
      this.locked = true
      this.lastPulseMs = nowMs
      return 'lock'
    }
    if (this.locked) {
      if (separationDeg > lockDeg * GuidanceTracker.RELEASE_FACTOR) {
        this.locked = false
        this.lastPulseMs = nowMs
        return 'unlock'
      }
      return null
    }
    if (separationDeg > GuidanceTracker.PULSE_MAX_DEG) return null
    if (nowMs - this.lastPulseMs >= pulseIntervalMs(separationDeg, lockDeg)) {
      this.lastPulseMs = nowMs
      return 'pulse'
    }
    return null
  }
}

/**
 * Consigne de pointage : rotation en azimut (positive = vers la droite / l'est,
 * chemin le plus court) et en hauteur (positive = lever) pour amener le centre
 * de vue sur la cible, en degrés.
 */
export function pointingDelta(viewAzDeg: number, viewAltDeg: number, targetAzDeg: number, targetAltDeg: number): { dAzDeg: number; dAltDeg: number } {
  return { dAzDeg: ((targetAzDeg - viewAzDeg + 540) % 360) - 180, dAltDeg: targetAltDeg - viewAltDeg }
}
