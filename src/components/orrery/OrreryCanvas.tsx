/**
 * Canevas WebGL du Système Solaire 3D : crée le moteur Three.js, pilote la
 * boucle `requestAnimationFrame` (via `useRef`) au rythme de l'horloge de
 * simulation, suit le `devicePixelRatio` et la taille du conteneur, place les
 * étiquettes et le réticule HTML, et détruit le contexte WebGL au démontage.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { ORRERY_BODIES, ORRERY_NAME_FR } from '../../data/solarSystemPhysical'
import { useSimulation, useTheme } from '../../hooks/useAppContext'
import { loadOrbitSet, orbitSetKey } from '../../services/orrery/orbits'
import { pickBody } from '../../services/orrery/picking'
import type { OrreryBodyId, OrrerySettings, OrreryViewMode } from '../../types/orrery'
import { layoutLabels } from './labelLayout'
import { OrreryEngine } from './orreryEngine'
import { useOrreryGestures } from './useOrreryGestures'

interface Props {
  readonly engineRef: RefObject<OrreryEngine | null>
  readonly settings: OrrerySettings
  readonly selected: OrreryBodyId | null
  onSelect(id: OrreryBodyId | null): void
  onFocus(id: OrreryBodyId | null): void
  onPinchStep(): void
  /** La vue courante a changé de préréglage par un geste (orbite vers le pôle, etc.). */
  onViewModeObserved(mode: OrreryViewMode): void
}

export function OrreryCanvas({ engineRef, settings, selected, onSelect, onFocus, onPinchStep, onViewModeObserved }: Props) {
  const { getSimMs } = useSimulation()
  const { palette, theme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const [webglError, setWebglError] = useState(false)
  const controllerRef = useRef<OrreryEngine['controller'] | null>(null)
  const labelRefs = useRef(new Map<OrreryBodyId, HTMLSpanElement>())
  // Largeurs des étiquettes mesurées une seule fois (police fixe) : aucun reflow par frame.
  const labelWidths = useRef(new Map<OrreryBodyId, number>())
  const reticleRef = useRef<HTMLDivElement>(null)
  const live = useRef({ settings, selected, onViewModeObserved })
  useEffect(() => {
    live.current = { settings, selected, onViewModeObserved }
  })

  // Création unique du moteur, boucle de rendu et nettoyage strict.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    // Canevas neuf à chaque montage : un canevas dont le contexte a été libéré
    // (forceContextLoss au démontage) ne peut plus fournir de contexte WebGL valide.
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 block h-full w-full'
    root.prepend(canvas)
    let engine: OrreryEngine
    try {
      engine = new OrreryEngine(canvas, palette, theme, live.current.settings.viewMode, getSimMs())
    } catch {
      canvas.remove()
      // Échec d'initialisation WebGL (contexte refusé, quota iOS atteint) : message de repli.
      queueMicrotask(() => setWebglError(true))
      return
    }
    engineRef.current = engine
    controllerRef.current = engine.controller
    let disposed = false
    let orbitKey = ''
    let lastFrame = performance.now()
    let lastModeCheck = 0
    let observedMode = engine.viewMode

    const resize = () => engine.resize(root.clientWidth, root.clientHeight, window.devicePixelRatio || 1)
    resize()
    engine.recenter(performance.now() - 10_000)
    const ro = new ResizeObserver(resize)
    ro.observe(root)
    // Le DPR change quand la fenêtre passe d'un écran à l'autre (web) : on réécoute à chaque bascule.
    let dprQuery: MediaQueryList | null = null
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDpr)
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      dprQuery.addEventListener('change', onDpr)
    }
    const onDpr = () => {
      resize()
      watchDpr()
    }
    watchDpr()

    let raf = 0
    const loop = (now: number) => {
      const simMs = getSimMs()
      const key = orbitSetKey(simMs)
      if (key !== orbitKey) {
        orbitKey = key
        void loadOrbitSet(simMs).then((set) => {
          if (!disposed && orbitKey === key) engine.setOrbits(set)
        })
      }
      engine.render(simMs, now, Math.min(0.1, (now - lastFrame) / 1000))
      lastFrame = now
      placeOverlays(engine)
      if (now - lastModeCheck > 250) {
        lastModeCheck = now
        const mode = engine.viewMode
        if (mode !== observedMode) {
          observedMode = mode
          live.current.onViewModeObserved(mode)
        }
      }
      raf = requestAnimationFrame(loop)
    }

    const placeOverlays = (e: OrreryEngine) => {
      const { settings: s, selected: sel } = live.current
      const picks = e.getPicks()
      const measure = (id: OrreryBodyId) => {
        const cached = labelWidths.current.get(id)
        if (cached) return cached
        const w = labelRefs.current.get(id)?.offsetWidth
        if (w) labelWidths.current.set(id, w)
        return w || undefined
      }
      const placed = s.showLabels ? layoutLabels(picks, sel, root.clientWidth, root.clientHeight, { moonSystemPx: e.moonSystemPx, measure }) : []
      const shown = new Set(placed.map((l) => l.id))
      for (const l of placed) {
        const span = labelRefs.current.get(l.id)
        if (span) span.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`
      }
      for (const [id, span] of labelRefs.current) span.style.visibility = shown.has(id) ? 'visible' : 'hidden'
      const reticle = reticleRef.current
      const target = sel ? picks.find((p) => p.id === sel) : undefined
      if (reticle) {
        if (target) {
          const size = Math.max(30, target.radiusPx * 2 + 16)
          reticle.style.visibility = 'visible'
          reticle.style.width = reticle.style.height = `${size.toFixed(0)}px`
          reticle.style.transform = `translate3d(${(target.x - size / 2).toFixed(1)}px, ${(target.y - size / 2).toFixed(1)}px, 0)`
        } else reticle.style.visibility = 'hidden'
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      dprQuery?.removeEventListener('change', onDpr)
      engine.dispose()
      canvas.remove()
      engineRef.current = null
      controllerRef.current = null
    }
    // Le moteur est créé une seule fois ; palette, réglages et sélection sont poussés par les effets ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSimMs, engineRef])

  useEffect(() => engineRef.current?.setPalette(palette, theme), [engineRef, palette, theme])
  useEffect(() => engineRef.current?.setOptions({ showOrbits: settings.showOrbits, follow: settings.follow }), [engineRef, settings.showOrbits, settings.follow])
  useEffect(() => engineRef.current?.setSelected(selected), [engineRef, selected])

  useOrreryGestures({
    elementRef: rootRef,
    controllerRef,
    onTap: (x, y) => onSelect(pickBody(engineRef.current?.getPicks() ?? [], x, y)),
    onDoubleTap: (x, y) => onFocus(pickBody(engineRef.current?.getPicks() ?? [], x, y)),
    onPinchStep,
  })

  return (
    <div ref={rootRef} className="absolute inset-0 touch-none select-none" role="img" aria-label="Système solaire en 3D : glisser pour tourner, pincer pour zoomer, toucher un astre pour sa télémétrie, toucher deux fois pour le centrer">
      {webglError && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] text-secondary" role="alert">
          WebGL est indisponible sur cet appareil : la vue 3D ne peut pas s’afficher. La télémétrie reste accessible via la liste des astres.
        </p>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {ORRERY_BODIES.map((id) => (
          <span
            key={id}
            ref={(el) => {
              if (el) labelRefs.current.set(id, el)
              else labelRefs.current.delete(id)
            }}
            className={`absolute top-0 left-0 px-1 text-[11px] leading-[15px] font-medium tracking-wide whitespace-nowrap will-change-transform ${
              id === selected ? 'text-accent' : 'text-secondary'
            }`}
            style={{ visibility: 'hidden' }}
          >
            {ORRERY_NAME_FR[id]}
          </span>
        ))}
        <div ref={reticleRef} className="absolute top-0 left-0 will-change-transform" style={{ visibility: 'hidden' }}>
          {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((c) => (
            <span key={c} className={`absolute h-2 w-2 border-accent ${c}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
