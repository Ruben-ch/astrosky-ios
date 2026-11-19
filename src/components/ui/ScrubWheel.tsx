/**
 * Molette temporelle : règle graduée horizontale (Canvas 2D, 60 fps) que l'on
 * fait glisser pour voyager dans le temps. Un cran haptique est émis à chaque
 * graduation de 15 minutes franchie. Glisser vers la gauche avance le temps.
 */
import { useRef } from 'react'
import { useSimulation, useTheme } from '../../hooks/useAppContext'
import { useSimFrame } from '../../hooks/useSimTime'
import { hapticTick } from '../../services/haptics'

/** Échelle de la règle : minutes simulées par pixel CSS. */
const MINUTES_PER_PX = 2
const MS_PER_PX = MINUTES_PER_PX * 60_000
const DETENT_MS = 15 * 60_000

export function ScrubWheel() {
  const { shiftBy, getSimMs } = useSimulation()
  const { palette } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; lastDetent: number } | null>(null)

  useSimFrame((simMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const center = w / 2
    const tzOffsetMs = new Date(simMs).getTimezoneOffset() * 60_000
    const localMs = simMs - tzOffsetMs
    const firstTick = Math.floor((localMs - center * MS_PER_PX) / DETENT_MS) * DETENT_MS
    ctx.font = '500 10px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (let t = firstTick; t <= localMs + center * MS_PER_PX; t += DETENT_MS) {
      const x = center + (t - localMs) / MS_PER_PX
      const minuteOfDay = ((t / 60_000) % 1440 + 1440) % 1440
      const isHour = minuteOfDay % 60 === 0
      const isMidnight = minuteOfDay === 0
      const len = isMidnight ? h * 0.62 : isHour ? h * 0.42 : h * 0.2
      const fade = 1 - Math.min(1, Math.abs(x - center) / center) * 0.75
      ctx.globalAlpha = fade
      ctx.strokeStyle = isHour ? palette.gridStrong : palette.grid
      ctx.lineWidth = isMidnight ? 1.5 : 1
      ctx.beginPath()
      ctx.moveTo(x, h)
      ctx.lineTo(x, h - len)
      ctx.stroke()
      if (isHour && minuteOfDay % 180 === 0) {
        ctx.fillStyle = isMidnight ? palette.accent : palette.textDim
        ctx.fillText(`${String(minuteOfDay / 60).padStart(2, '0')}h`, x, 11)
      }
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(center, 16)
    ctx.lineTo(center, h)
    ctx.stroke()
    ctx.fillStyle = palette.accent
    ctx.beginPath()
    ctx.moveTo(center - 5, 14)
    ctx.lineTo(center + 5, 14)
    ctx.lineTo(center, 20)
    ctx.closePath()
    ctx.fill()
  })

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, lastDetent: Math.floor(getSimMs() / DETENT_MS) }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (dx === 0) return
    d.x = e.clientX
    shiftBy(-dx * MS_PER_PX)
    const detent = Math.floor(getSimMs() / DETENT_MS)
    if (detent !== d.lastDetent) {
      d.lastDetent = detent
      void hapticTick()
    }
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      role="slider"
      aria-label="Molette temporelle : glisser pour avancer ou reculer dans le temps"
      aria-valuetext={new Date(getSimMs()).toLocaleString('fr-FR')}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') shiftBy(DETENT_MS)
        if (e.key === 'ArrowLeft') shiftBy(-DETENT_MS)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="block h-14 w-full touch-none rounded-2xl bg-bg-primary/60"
    />
  )
}
