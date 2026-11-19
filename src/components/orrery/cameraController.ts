/**
 * Contrôleur de caméra du Système Solaire 3D : état orbital, inertie après un
 * glissement, transitions animées (centrage d'un astre, changement de vue) et
 * suivi d'un astre en mouvement. S'appuie sur les fonctions pures de
 * `services/orrery/cameraRig`.
 */
import {
  applyOrbit,
  applyZoom,
  decay,
  dragToAngles,
  initialCamera,
  interpolateCamera,
  MIN_DISTANCE,
  VIEW_ELEVATION_RAD,
} from '../../services/orrery/cameraRig'
import type { OrbitCameraState, OrreryBodyId, OrreryViewMode, Vec3 } from '../../types/orrery'

const FOCUS_MS = 750
const VIEW_MS = 650

interface Animation {
  readonly from: OrbitCameraState
  /** Destination (la cible est remplacée à chaque frame par la position de l'astre suivi). */
  readonly to: OrbitCameraState
  readonly startMs: number
  readonly durationMs: number
}

export class CameraController {
  state: OrbitCameraState
  /** Astre suivi (cible de la caméra), `null` = point fixe. */
  focusId: OrreryBodyId | null = null
  follow = true
  /** Distance minimale tant qu'un astre est centré (ne pas traverser son globe). */
  minDistance = MIN_DISTANCE
  private velAz = 0
  private velEl = 0
  private anim: Animation | null = null
  private dragging = false

  constructor(mode: OrreryViewMode, fitRadius: number, aspect: number) {
    this.state = initialCamera(mode, fitRadius, aspect)
  }

  /** Glissement d'un doigt (px CSS) : orbite immédiate, l'inertie repart au relâchement. */
  drag(dxPx: number, dyPx: number, heightPx: number): void {
    this.anim = null
    this.dragging = true
    const d = dragToAngles(dxPx, dyPx, heightPx)
    this.state = applyOrbit(this.state, d.dAzimuthRad, d.dElevationRad)
  }

  /** Fin de glissement avec une vitesse (px/s) : lancement de l'inertie. */
  release(vxPxS: number, vyPxS: number, heightPx: number): void {
    this.dragging = false
    const d = dragToAngles(vxPxS, vyPxS, heightPx)
    this.velAz = d.dAzimuthRad
    this.velEl = d.dElevationRad
  }

  stopInertia(): void {
    this.velAz = 0
    this.velEl = 0
  }

  zoom(factor: number): void {
    if (this.anim) this.anim = { ...this.anim, to: applyZoom(this.anim.to, factor, this.minDistance) }
    else this.state = applyZoom(this.state, factor, this.minDistance)
  }

  /** Centre la caméra sur un astre (ou sur le point `target` si `id` est nul). */
  focus(id: OrreryBodyId | null, target: Vec3, distance: number, nowMs: number, minDistance = MIN_DISTANCE): void {
    this.stopInertia()
    this.focusId = id
    this.minDistance = minDistance
    this.anim = { from: this.state, to: { ...this.state, target, distance }, startMs: nowMs, durationMs: FOCUS_MS }
  }

  /** Bascule animée entre la vue rasante (écliptique) et la vue polaire. */
  setViewMode(mode: OrreryViewMode, nowMs: number): void {
    this.stopInertia()
    const base = this.anim?.to ?? this.state
    this.anim = { from: this.state, to: { ...base, elevationRad: VIEW_ELEVATION_RAD[mode] }, startMs: nowMs, durationMs: VIEW_MS }
  }

  /** Avance d'une frame : inertie, animation, suivi de l'astre centré. */
  step(dtS: number, nowMs: number, focusPosition: Vec3 | null): OrbitCameraState {
    const followTarget = this.focusId && focusPosition && this.follow ? focusPosition : null
    if (this.anim) {
      const a = this.anim
      const to = focusPosition && this.focusId ? { ...a.to, target: focusPosition } : a.to
      const t = (nowMs - a.startMs) / a.durationMs
      this.state = interpolateCamera(a.from, to, t)
      if (t >= 1) this.anim = null
      return this.state
    }
    if (!this.dragging && (this.velAz !== 0 || this.velEl !== 0)) {
      this.state = applyOrbit(this.state, this.velAz * dtS, this.velEl * dtS)
      this.velAz = decay(this.velAz, dtS)
      this.velEl = decay(this.velEl, dtS)
    }
    if (followTarget) this.state = { ...this.state, target: followTarget }
    return this.state
  }

  get animating(): boolean {
    return this.anim !== null
  }
}
