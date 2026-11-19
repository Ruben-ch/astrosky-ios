/**
 * Courbe d'élévation nocturne (Canvas 2D) : bandes crépusculaires, seuil
 * d'observabilité à 15°, graduations horaires, relevés heure par heure,
 * culmination annotée et curseur du temps simulé. Palette injectée.
 */
import type { RenderPalette } from '../../../theme/palette'
import type { NightElevationProfile } from '../../../types/encyclopedia'
import type { TwilightPhase } from '../../../types/tonight'

const ALT_MIN = -15
const ALT_MAX = 90
export const ELEVATION_PAD = { left: 28, right: 10, top: 24, bottom: 20 } as const
const PHASE_INDEX: Record<TwilightPhase, 0 | 1 | 2 | 3 | 4> = { day: 0, civil: 1, nautical: 2, astronomical: 3, night: 4 }

const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function drawElevation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  prof: NightElevationProfile,
  nowMs: number,
  thresholdDeg: number,
  p: RenderPalette,
): void {
  const P = ELEVATION_PAD
  const t0 = prof.start.getTime()
  const t1 = prof.end.getTime()
  const plotW = width - P.left - P.right
  const plotH = height - P.top - P.bottom
  const x = (t: number) => P.left + ((Math.min(t1, Math.max(t0, t)) - t0) / (t1 - t0)) * plotW
  const y = (a: number) => P.top + ((ALT_MAX - Math.max(ALT_MIN, Math.min(ALT_MAX, a))) / (ALT_MAX - ALT_MIN)) * plotH

  for (const s of prof.segments) {
    const xa = x(s.start.getTime())
    const xb = x(s.end.getTime())
    if (xb <= xa) continue
    ctx.fillStyle = p.twilight[PHASE_INDEX[s.phase]]
    ctx.fillRect(xa, P.top, xb - xa + 0.5, plotH)
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(P.left, y(0), plotW, y(ALT_MIN) - y(0))

  // Grille de hauteur et seuil d'observabilité.
  ctx.font = '500 9px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const a of [0, 30, 45, 60, 90]) {
    ctx.strokeStyle = a === 0 ? p.gridStrong : p.grid
    ctx.lineWidth = a === 0 ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(P.left, Math.round(y(a)) + 0.5)
    ctx.lineTo(width - P.right, Math.round(y(a)) + 0.5)
    ctx.stroke()
    if (a !== 45) {
      ctx.fillStyle = p.textDim
      ctx.fillText(`${a}°`, P.left - 4, y(a))
    }
  }
  ctx.strokeStyle = p.fov.threshold
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(P.left, Math.round(y(thresholdDeg)) + 0.5)
  ctx.lineTo(width - P.right, Math.round(y(thresholdDeg)) + 0.5)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = p.fov.threshold
  ctx.fillText(`${thresholdDeg}°`, P.left - 4, y(thresholdDeg))

  // Graduations horaires : étiquette toutes les 2 h.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const h of prof.hourly) {
    const xx = Math.round(x(h.time.getTime())) + 0.5
    const hour = h.time.getHours()
    ctx.strokeStyle = p.grid
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(xx, P.top)
    ctx.lineTo(xx, y(ALT_MIN) + (hour % 2 === 0 ? 4 : 2))
    ctx.stroke()
    if (hour % 2 === 0 && xx > P.left + 8 && xx < width - P.right - 8) {
      ctx.fillStyle = p.textDim
      ctx.fillText(`${String(hour).padStart(2, '0')}h`, xx, height - P.bottom + 6)
    }
  }

  // Courbe : pleine au-dessus de l'horizon, atténuée en dessous.
  const path = new Path2D()
  prof.samples.forEach((s, i) => (i === 0 ? path.moveTo(x(s.time.getTime()), y(s.altitudeDeg)) : path.lineTo(x(s.time.getTime()), y(s.altitudeDeg))))
  ctx.strokeStyle = p.bodies.target
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.save()
  ctx.beginPath()
  ctx.rect(P.left, P.top, plotW, y(0) - P.top)
  ctx.clip()
  ctx.stroke(path)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.rect(P.left, y(0), plotW, y(ALT_MIN) - y(0))
  ctx.clip()
  ctx.globalAlpha = 0.35
  ctx.stroke(path)
  ctx.restore()

  // Relevés horaires : disque plein si observable en nuit noire.
  for (const h of prof.hourly) {
    const px = x(h.time.getTime())
    const py = y(h.altitudeDeg)
    ctx.beginPath()
    ctx.arc(px, py, 2.6, 0, Math.PI * 2)
    if (h.dark && h.altitudeDeg > thresholdDeg) {
      ctx.fillStyle = p.bodies.target
      ctx.fill()
    } else {
      ctx.fillStyle = p.background
      ctx.fill()
      ctx.strokeStyle = p.bodies.target
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // Culmination.
  const c = prof.culmination
  if (c.altitudeDeg > ALT_MIN) {
    const cx = x(c.time.getTime())
    const cy = y(c.altitudeDeg)
    ctx.strokeStyle = p.gold
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(Math.round(cx) + 0.5, cy)
    ctx.lineTo(Math.round(cx) + 0.5, y(ALT_MIN))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = p.gold
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    const label = `Culm. ${hhmm(c.time)} · ${Math.round(c.altitudeDeg)}°`
    ctx.font = '600 10px -apple-system, system-ui, sans-serif'
    const tw = ctx.measureText(label).width
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, Math.min(width - P.right - tw, Math.max(P.left, cx - tw / 2)), Math.max(12, cy - 6))
  }

  // Temps simulé.
  if (nowMs >= t0 && nowMs <= t1) {
    const xn = Math.round(x(nowMs)) + 0.5
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(xn, P.top)
    ctx.lineTo(xn, y(ALT_MIN))
    ctx.stroke()
    ctx.fillStyle = p.accent
    ctx.beginPath()
    ctx.arc(xn, y(ALT_MIN), 3, 0, Math.PI * 2)
    ctx.fill()
  }
}
