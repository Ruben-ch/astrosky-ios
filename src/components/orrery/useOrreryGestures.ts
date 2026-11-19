/**
 * Gestes tactiles du Système Solaire 3D : un doigt = orbite de la caméra avec
 * inertie au relâchement, deux doigts = pinch-to-zoom, tape = sélection,
 * double-tap = centrer l'astre, molette / trackpad = zoom sur le web.
 * Les gestes sont traduits en appels au `CameraController` (aucun re-rendu React).
 */
import { useEffect, useRef, type RefObject } from 'react'
import { isDoubleTap, TAP_SLOP_PX, type TapRecord } from '../../services/orrery/picking'
import type { CameraController } from './cameraController'

const TAP_MAX_MS = 350
/** Au-delà de ce délai sans mouvement avant le relâchement, pas d'inertie. */
const FLING_MAX_IDLE_MS = 80

interface Options {
  readonly elementRef: RefObject<HTMLElement | null>
  readonly controllerRef: RefObject<CameraController | null>
  onTap(x: number, y: number): void
  onDoubleTap(x: number, y: number): void
  onPinchStep(): void
}

export function useOrreryGestures({ elementRef, controllerRef, onTap, onDoubleTap, onPinchStep }: Options): void {
  const cb = useRef({ onTap, onDoubleTap, onPinchStep })
  useEffect(() => {
    cb.current = { onTap, onDoubleTap, onPinchStep }
  })

  useEffect(() => {
    const el = elementRef.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number; t: number; moved: number } | null = null
    let last: { x: number; y: number; t: number } | null = null
    let velocity = { x: 0, y: 0 } // px/s lissés
    let pinchDist = 0
    let pinchAccum = 1
    let lastTap: TapRecord | null = null

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top, h: r.height }
    }

    const down = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId)
      const p = local(e)
      pointers.set(e.pointerId, { x: p.x, y: p.y })
      controllerRef.current?.stopInertia()
      if (pointers.size === 1) {
        const now = performance.now()
        start = { x: p.x, y: p.y, t: now, moved: 0 }
        last = { x: p.x, y: p.y, t: now }
        velocity = { x: 0, y: 0 }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        pinchAccum = 1
        start = null
      }
    }

    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const p = local(e)
      pointers.set(e.pointerId, { x: p.x, y: p.y })
      const ctl = controllerRef.current
      if (!ctl) return
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist > 0 && d > 0) {
          ctl.zoom(pinchDist / d)
          // Cran haptique tous les ~25 % de zoom cumulé.
          pinchAccum *= d / pinchDist
          if (pinchAccum > 1.25 || pinchAccum < 0.8) {
            pinchAccum = 1
            cb.current.onPinchStep()
          }
        }
        pinchDist = d
        return
      }
      if (start) start.moved = Math.max(start.moved, Math.hypot(p.x - start.x, p.y - start.y))
      if (start && start.moved < TAP_SLOP_PX) return
      const now = performance.now()
      if (last) {
        const dt = Math.max(1, now - last.t) / 1000
        velocity = { x: 0.6 * velocity.x + 0.4 * ((p.x - prev.x) / dt), y: 0.6 * velocity.y + 0.4 * ((p.y - prev.y) / dt) }
      }
      last = { x: p.x, y: p.y, t: now }
      ctl.drag(p.x - prev.x, p.y - prev.y, p.h)
    }

    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      const p = local(e)
      const now = performance.now()
      const ctl = controllerRef.current
      if (pointers.size > 0) {
        // Fin de pinch : le doigt restant reprend l'orbite sans saut ni tape fantôme.
        const [rest] = [...pointers.values()]
        start = { x: rest.x, y: rest.y, t: now, moved: TAP_SLOP_PX }
        last = { x: rest.x, y: rest.y, t: now }
        return
      }
      if (start && start.moved < TAP_SLOP_PX && now - start.t < TAP_MAX_MS) {
        const tap = { timeMs: now, x: p.x, y: p.y }
        if (isDoubleTap(lastTap, tap)) {
          lastTap = null
          cb.current.onDoubleTap(p.x, p.y)
        } else {
          lastTap = tap
          cb.current.onTap(p.x, p.y)
        }
      } else if (ctl) {
        const idle = last ? now - last.t : Infinity
        if (idle < FLING_MAX_IDLE_MS) ctl.release(velocity.x, velocity.y, p.h)
        else ctl.release(0, 0, p.h)
      }
      start = null
      last = null
    }

    // Contact annulé par le système (appel entrant, geste iOS) : jamais de tape.
    const cancel = (e: PointerEvent) => {
      start = null
      up(e)
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      controllerRef.current?.zoom(Math.exp(e.deltaY * 0.0015))
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('wheel', wheel)
    }
  }, [elementRef, controllerRef])
}
