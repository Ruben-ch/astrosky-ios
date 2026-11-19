/**
 * Gestes tactiles du planétarium : pan « attrapé » (la direction sous le doigt
 * suit le doigt) avec inertie, pinch-to-zoom centré sur les doigts, toucher pour
 * sélectionner, molette/trackpad sur le web. En mode capteurs, seul le pan est coupé.
 * En Caméra AR : le pincement ne change que le champ (borné), et un glissement
 * horizontal à un doigt recale l'azimut (`onCalibrate`) au lieu de déplacer la vue.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { panView, zoomView } from '../../services/sky/projection'
import type { ProjectionKind, SkyView } from '../../types/sky'

/** Bornes de champ imposées (Caméra AR) : le zoom ne déplace alors pas la visée. */
export interface FovLimits {
  readonly min: number
  readonly max: number
}

const TAP_MAX_MOVE_PX = 8
const TAP_MAX_MS = 350
/** Constante de temps de l'inertie après un lancer, en ms. */
const INERTIA_TAU_MS = 320

interface Options {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>
  readonly viewRef: RefObject<SkyView>
  readonly projectionRef: RefObject<ProjectionKind>
  readonly panEnabledRef: RefObject<boolean>
  readonly fovLimitsRef?: RefObject<FovLimits | null>
  /** Recalage horizontal (AR) : déplacement en px depuis l'évènement précédent, largeur du canevas. */
  readonly calibrateRef?: RefObject<((dxPx: number, widthPx: number) => void) | null>
  onTap(x: number, y: number): void
  onUserMove(): void
}

export function useSkyGestures({ canvasRef, viewRef, projectionRef, panEnabledRef, fovLimitsRef, calibrateRef, onTap, onUserMove }: Options): void {
  const cb = useRef({ onTap, onUserMove })
  useEffect(() => {
    cb.current = { onTap, onUserMove }
  })

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number; t: number; moved: number } | null = null
    let last: { x: number; y: number; t: number } | null = null
    let velocity = { az: 0, alt: 0 } // degrés par ms
    let pinchDist = 0
    let inertiaRaf = 0

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }
    }
    const apply = (next: SkyView) => {
      viewRef.current = next
      cb.current.onUserMove()
    }
    /** Zoom d'un facteur autour d'un pivot ; en AR, champ seul et borné. */
    const zoom = (factor: number, vp: { width: number; height: number }, px: number, py: number) => {
      const lim = fovLimitsRef?.current
      if (lim) {
        const v = viewRef.current
        apply({ ...v, fovDeg: Math.min(lim.max, Math.max(lim.min, v.fovDeg / factor)) })
      } else apply(zoomView(viewRef.current, projectionRef.current, vp, factor, px, py))
    }

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      cancelAnimationFrame(inertiaRaf)
      const p = local(e)
      pointers.set(e.pointerId, { x: p.x, y: p.y })
      if (pointers.size === 1) {
        start = { x: p.x, y: p.y, t: performance.now(), moved: 0 }
        last = { x: p.x, y: p.y, t: performance.now() }
        velocity = { az: 0, alt: 0 }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        start = null
      }
    }

    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      const vp = { width: p.w, height: p.h }
      const prev = pointers.get(e.pointerId)!
      pointers.set(e.pointerId, { x: p.x, y: p.y })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist > 0 && d > 0) zoom(d / pinchDist, vp, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinchDist = d
        return
      }
      if (start) start.moved = Math.max(start.moved, Math.hypot(p.x - start.x, p.y - start.y))
      if (start && start.moved < TAP_MAX_MOVE_PX) return
      const calibrate = calibrateRef?.current
      if (!panEnabledRef.current && calibrate) {
        calibrate(p.x - prev.x, p.w)
        return
      }
      if (!panEnabledRef.current) return
      const before = viewRef.current
      const next = panView(before, projectionRef.current, vp, prev.x, prev.y, p.x, p.y)
      const now = performance.now()
      if (last) {
        const dt = Math.max(1, now - last.t)
        const dAz = ((next.azimuthDeg - before.azimuthDeg + 540) % 360) - 180
        velocity = { az: 0.6 * velocity.az + 0.4 * (dAz / dt), alt: 0.6 * velocity.alt + 0.4 * ((next.altitudeDeg - before.altitudeDeg) / dt) }
      }
      last = { x: p.x, y: p.y, t: now }
      apply(next)
    }

    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      const p = local(e)
      if (pointers.size > 0) {
        // Fin de pinch : le doigt restant reprend le pan sans saut.
        const [rest] = [...pointers.values()]
        last = { x: rest.x, y: rest.y, t: performance.now() }
        start = { x: rest.x, y: rest.y, t: performance.now(), moved: TAP_MAX_MOVE_PX }
        return
      }
      if (start && start.moved < TAP_MAX_MOVE_PX && performance.now() - start.t < TAP_MAX_MS) {
        cb.current.onTap(p.x, p.y)
      } else if (panEnabledRef.current && last && performance.now() - last.t < 80 && Math.hypot(velocity.az, velocity.alt) > 0.005) {
        let prevT = performance.now()
        const step = (t: number) => {
          const dt = t - prevT
          prevT = t
          const decay = Math.exp(-dt / INERTIA_TAU_MS)
          velocity = { az: velocity.az * decay, alt: velocity.alt * decay }
          const v = viewRef.current
          apply({ ...v, azimuthDeg: (v.azimuthDeg + velocity.az * dt + 360) % 360, altitudeDeg: Math.max(-90, Math.min(90, v.altitudeDeg + velocity.alt * dt)) })
          if (Math.hypot(velocity.az, velocity.alt) > 0.0005) inertiaRaf = requestAnimationFrame(step)
        }
        inertiaRaf = requestAnimationFrame(step)
      }
      start = null
      last = null
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      zoom(Math.exp(-e.deltaY * 0.0015), { width: p.w, height: p.h }, p.x, p.y)
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(inertiaRaf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [canvasRef, viewRef, projectionRef, panEnabledRef, fovLimitsRef, calibrateRef])
}
