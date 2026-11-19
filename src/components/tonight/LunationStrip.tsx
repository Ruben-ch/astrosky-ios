/**
 * Courbe d'illumination de la lunaison courante (nouvelle → nouvelle lune) en
 * Canvas 2D : remplissage sous la courbe, repère de pleine lune, position actuelle.
 */
import { useHiDpiCanvas } from '../../hooks/useHiDpiCanvas'
import { useTheme } from '../../hooks/useAppContext'
import type { MoonDetail } from '../../types/tonight'

export function LunationStrip({ moon, nowMs }: { moon: MoonDetail; nowMs: number }) {
  const { palette: p } = useTheme()
  const ref = useHiDpiCanvas(
    (ctx, { width, height }) => {
      const c = moon.lunationCurve
      if (c.length < 2) return
      const t0 = c[0].time.getTime()
      const t1 = c[c.length - 1].time.getTime()
      const padY = 4
      const x = (t: number) => ((t - t0) / (t1 - t0)) * width
      const y = (f: number) => height - padY - f * (height - 2 * padY)

      ctx.strokeStyle = p.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y(0) + 0.5)
      ctx.lineTo(width, y(0) + 0.5)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, y(0))
      for (const pt of c) ctx.lineTo(x(pt.time.getTime()), y(pt.illuminatedFraction))
      ctx.lineTo(width, y(0))
      ctx.closePath()
      ctx.fillStyle = p.horizonFill
      ctx.fill()
      ctx.beginPath()
      c.forEach((pt, i) => (i === 0 ? ctx.moveTo(x(pt.time.getTime()), y(pt.illuminatedFraction)) : ctx.lineTo(x(pt.time.getTime()), y(pt.illuminatedFraction))))
      ctx.strokeStyle = p.moonLit
      ctx.lineWidth = 1.5
      ctx.stroke()

      const full = moon.nextFullMoon.getTime()
      if (full <= t1) {
        ctx.setLineDash([2, 3])
        ctx.strokeStyle = p.gridStrong
        ctx.beginPath()
        ctx.moveTo(Math.round(x(full)) + 0.5, padY)
        ctx.lineTo(Math.round(x(full)) + 0.5, height - padY)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (nowMs >= t0 && nowMs <= t1) {
        ctx.fillStyle = p.accent
        ctx.beginPath()
        ctx.arc(x(nowMs), y(moon.illuminatedFraction), 4, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [moon, nowMs, p],
  )
  return <canvas ref={ref} role="img" aria-label="Illumination de la Lune sur la lunaison en cours" className="block h-12 w-full" />
}
