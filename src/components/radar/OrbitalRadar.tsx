/**
 * Radar orbital interactif (Canvas 2D, boucle rAF via useSimFrame) : satellites
 * levés rafraîchis 4 fois par seconde, satellite sélectionné propagé à chaque
 * image, trajectoire du passage choisi. Toucher un satellite le sélectionne.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useTheme } from '../../hooks/useAppContext'
import { useSimFrame } from '../../hooks/useSimTime'
import { createSampler } from '../../services/satellite/passTrack'
import { satelliteDisplayName } from '../../services/satellite/brightCatalog'
import type { ObserverLocation } from '../../types/astro'
import type { OrbitalCandidate, VisiblePass } from '../../types/orbital'
import { drawRadar, pickBlip, type LiveBlip } from './radarDraw'

interface Props {
  candidates: readonly OrbitalCandidate[]
  loc: ObserverLocation
  pass: VisiblePass | null
  selectedId: number | null
  onSelect(noradId: number): void
  /** Satellites levés, publiés 4 fois par seconde pour la liste « En ce moment ». */
  onBlips?(blips: readonly LiveBlip[]): void
}

const BLIP_REFRESH_MS = 250
/** Une rotation complète du balayage, en millisecondes réelles. */
const SWEEP_PERIOD_MS = 6000

export function OrbitalRadar({ candidates, loc, pass, selectedId, onSelect, onBlips }: Props) {
  const { palette } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blipsRef = useRef<LiveBlip[]>([])
  const lastRefresh = useRef({ real: -Infinity, sim: NaN })
  const samplers = useMemo(
    () => candidates.map((c) => ({ c, name: satelliteDisplayName(c.record), sampler: createSampler(c.record, loc) })),
    [candidates, loc],
  )
  const onBlipsRef = useRef(onBlips)
  useEffect(() => {
    onBlipsRef.current = onBlips
  })

  useSimFrame((simMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const real = performance.now()
    if (real - lastRefresh.current.real > BLIP_REFRESH_MS || Math.abs(simMs - lastRefresh.current.sim) > 30_000) {
      lastRefresh.current = { real, sim: simMs }
      const next: LiveBlip[] = []
      for (const s of samplers) {
        if (s.sampler.elevation(simMs) <= 0) continue
        const pt = s.sampler.sample(simMs, { stdMag: s.c.stdMag })
        if (pt) next.push({ noradId: s.c.record.noradId, name: s.name, azimuthDeg: pt.azimuthDeg, elevationDeg: pt.elevationDeg, sunlit: pt.sunlit, magnitude: pt.magnitude })
      }
      blipsRef.current = next
      onBlipsRef.current?.(next)
    }
    const sel = samplers.find((s) => s.c.record.noradId === selectedId)
    const selPt = sel?.sampler.sample(simMs, { stdMag: sel.c.stdMag }) ?? null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawRadar(ctx, w, h, {
      blips: blipsRef.current,
      pass,
      selectedId,
      selectedPos: selPt,
      sweepRad: ((real % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS) * Math.PI * 2,
    }, palette)
  })

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Radar orbital polaire${pass ? ` : trajectoire du passage de ${pass.name}` : ''}`}
      className="mx-auto block aspect-square w-full max-w-[360px] touch-manipulation"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const hit = pickBlip(r.width, r.height, blipsRef.current, e.clientX - r.left, e.clientY - r.top)
        if (hit) onSelect(hit.noradId)
      }}
    />
  )
}
