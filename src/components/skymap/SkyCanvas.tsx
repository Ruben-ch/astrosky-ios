/**
 * Canevas plein cadre du planétarium : boucle rAF (via `useSimFrame`), gestion
 * de `devicePixelRatio`, rendu par `SkyEngine`, suivi du guidage à chaque frame
 * (impulsions et verrouillage remontés par `onGuidanceEvent`).
 */
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useObserver, useTheme } from '../../hooks/useAppContext'
import { useSimFrame } from '../../hooks/useSimTime'
import { GuidanceTracker, lockRadiusDeg } from '../../services/sky/guidance'
import { viewBasis } from '../../services/sky/projection'
import { eqjVector, transformVector } from '../../services/sky/skyFrame'
import { isSatelliteUnavailable, objectDirection } from '../../services/sky/skyObjects'
import { angleBetweenDeg } from '../../services/sky/vector'
import type { GuidanceEvent, ProjectionKind, SkyObjectRef, SkySettings, SkyView, Vec3 } from '../../types/sky'
import type { ScreenRect } from './frame'
import type { SkyEngine } from './skyEngine'
import { useSkyGestures, type FovLimits } from './useSkyGestures'

interface Props {
  engine: SkyEngine
  viewRef: RefObject<SkyView>
  settings: SkySettings
  selected: SkyObjectRef | null
  target: SkyObjectRef | null
  onTap(ref: SkyObjectRef | null): void
  onUserMove(): void
  onGuidanceEvent(e: GuidanceEvent): void
  /** Projection effective (gnomonique imposée en Caméra AR). */
  projection: ProjectionKind
  /** Glisser déplace la vue (tactile, ou AR sans capteurs actifs). */
  panEnabled: boolean
  /** Caméra AR : canevas transparent sur la vidéo. */
  transparent?: boolean
  fovLimits?: FovLimits | null
  onCalibrate?: ((dxPx: number, widthPx: number) => void) | null
  /** Accès au canevas (photo AR annotée). */
  canvasRef?: RefObject<HTMLCanvasElement | null>
}

export function SkyCanvas({ engine, viewRef, settings, selected, target, onTap, onUserMove, onGuidanceEvent, projection, panEnabled, transparent = false, fovLimits = null, onCalibrate = null, canvasRef: externalRef }: Props) {
  const ownRef = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = externalRef ?? ownRef
  const { location } = useObserver()
  const { palette, theme } = useTheme()
  const projectionRef = useRef(projection)
  const panEnabledRef = useRef(panEnabled)
  const fovLimitsRef = useRef<FovLimits | null>(fovLimits)
  const calibrateRef = useRef(onCalibrate)
  useEffect(() => {
    projectionRef.current = projection
    panEnabledRef.current = panEnabled
    fovLimitsRef.current = fovLimits
    calibrateRef.current = onCalibrate
  })
  const tracker = useMemo(() => new GuidanceTracker(), [])
  const lockedRef = useRef(false)
  const targetKey = target?.key ?? null
  const trackedKey = useRef<string | null>(null)
  const hud = useRef<{ at: number; rects: ScreenRect[] }>({ at: -Infinity, rects: [] })

  /** Rectangles des surcouches `[data-sky-hud]` relatifs au canevas, remesurés 4 fois par seconde. */
  const hudRects = (canvas: HTMLCanvasElement, now: number): ScreenRect[] => {
    if (now - hud.current.at < 250) return hud.current.rects
    const origin = canvas.getBoundingClientRect()
    const rects = [...document.querySelectorAll<HTMLElement>('[data-sky-hud]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
    })
    hud.current = { at: now, rects }
    return rects
  }

  const { latitudeDeg, longitudeDeg, elevationM } = location
  const loc = useMemo(() => ({ latitudeDeg, longitudeDeg, elevationM }), [latitudeDeg, longitudeDeg, elevationM])
  const fixedEqj = (ref: SkyObjectRef | null) => (ref && !ref.bodyId && ref.noradId == null ? eqjVector(ref.raDeg, ref.decDeg) : null)
  const targetEqj = useMemo(() => fixedEqj(target), [target])
  const selectedEqj = useMemo(() => fixedEqj(selected), [selected])

  useSkyGestures({
    canvasRef, viewRef, projectionRef, panEnabledRef, fovLimitsRef, calibrateRef, onUserMove,
    onTap: (x, y) => onTap(engine.pick(x, y)),
  })

  useSimFrame((simMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const direction = (ref: SkyObjectRef | null, eqj: Vec3 | null): Vec3 | null => {
      if (!ref) return null
      if (ref.bodyId) return engine.bodyDirection(ref.key)
      const m = engine.eqjToEnu
      if (ref.noradId != null) return m && !isSatelliteUnavailable(ref, new Date(simMs)) ? objectDirection(ref, new Date(simMs), loc, m) : null
      return m && eqj ? transformVector(m, eqj) : null
    }
    const view = viewRef.current
    engine.render(
      ctx,
      {
        width: w, height: h, view, projection, layers: settings.layers, palette, theme, simMs, loc, transparent,
        timeSec: performance.now() / 1000, selected, target, targetLocked: lockedRef.current, hud: hudRects(canvas, performance.now()),
      },
      // Directions de la frame précédente (la matrice est mise à jour pendant le rendu).
      direction(target, targetEqj),
      direction(selected, selectedEqj),
    )

    if (trackedKey.current !== targetKey) {
      trackedKey.current = targetKey
      tracker.reset()
      lockedRef.current = false
    }
    const tDir = direction(target, targetEqj)
    if (tDir) {
      const sep = angleBetweenDeg(viewBasis(view).f, tDir)
      const ev = tracker.update(sep, lockRadiusDeg(view.fovDeg), performance.now())
      lockedRef.current = tracker.isLocked
      if (ev) onGuidanceEvent(ev)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Carte du ciel interactive : glisser pour explorer, pincer pour zoomer, toucher un astre pour le sélectionner"
      className="absolute inset-0 block h-full w-full touch-none"
    />
  )
}
