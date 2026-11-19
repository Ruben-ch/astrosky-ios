/**
 * Graphique de hauteur sur 24 h (midi → midi) en Canvas 2D HiDPI :
 * fond ombré selon la hauteur du Soleil (jour, crépuscules, nuit), grille
 * fine graduée en degrés et en heures locales, courbes des astres, curseur temps.
 */
import { useHiDpiCanvas } from '../../hooks/useHiDpiCanvas'
import { useTheme } from '../../hooks/useAppContext'
import type { AltitudeSample } from '../../types/astro'
import type { RenderPalette } from '../../theme/palette'
import { placeCurveLabels, type LabelRequest } from './altitudeLabels'

export interface AltitudeSeries {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly samples: readonly AltitudeSample[]
  readonly emphasis?: boolean
  /** Magnitude visuelle : départage les étiquettes en collision (le plus brillant gagne). */
  readonly magnitude?: number
}

interface Props {
  series: readonly AltitudeSeries[]
  sun: readonly AltitudeSample[]
  nowMs: number
  height?: number
  ariaLabel: string
}

const ALT_MIN = -10
const ALT_MAX = 90
const PAD = { left: 30, right: 8, top: 10, bottom: 20 }

function sunBand(altDeg: number, p: RenderPalette): string {
  if (altDeg > 0) return p.twilight[0]
  if (altDeg > -6) return p.twilight[1]
  if (altDeg > -12) return p.twilight[2]
  if (altDeg > -18) return p.twilight[3]
  return p.twilight[4]
}

const labelFont = (s: AltitudeSeries) => `${s.emphasis ? 600 : 500} 10px -apple-system, system-ui, sans-serif`

export function AltitudeChart({ series, sun, nowMs, height = 200, ariaLabel }: Props) {
  const { palette: p } = useTheme()

  const ref = useHiDpiCanvas(
    (ctx, { width, height: h }) => {
      if (sun.length < 2) return
      const t0 = sun[0].time.getTime()
      const t1 = sun[sun.length - 1].time.getTime()
      const plotW = width - PAD.left - PAD.right
      const plotH = h - PAD.top - PAD.bottom
      const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW
      const y = (alt: number) => PAD.top + ((ALT_MAX - Math.max(ALT_MIN, Math.min(ALT_MAX, alt))) / (ALT_MAX - ALT_MIN)) * plotH

      // Bandes crépusculaires.
      for (let i = 0; i < sun.length - 1; i++) {
        ctx.fillStyle = sunBand(sun[i].altitudeDeg, p)
        const xa = x(sun[i].time.getTime())
        ctx.fillRect(xa, PAD.top, x(sun[i + 1].time.getTime()) - xa + 0.5, plotH)
      }
      // Sous l'horizon.
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(PAD.left, y(0), plotW, y(ALT_MIN) - y(0))

      // Grille hauteur.
      ctx.font = '500 9px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let a = 0; a <= 90; a += 15) {
        ctx.strokeStyle = a === 0 ? p.gridStrong : p.grid
        ctx.lineWidth = a === 0 ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(PAD.left, Math.round(y(a)) + 0.5)
        ctx.lineTo(width - PAD.right, Math.round(y(a)) + 0.5)
        ctx.stroke()
        if (a % 30 === 0) {
          ctx.fillStyle = p.textDim
          ctx.fillText(`${a}°`, PAD.left - 5, y(a))
        }
      }
      // Grille horaire (heures locales rondes).
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const firstHour = Math.ceil(t0 / 3_600_000) * 3_600_000
      for (let t = firstHour; t <= t1; t += 3_600_000) {
        const hour = new Date(t).getHours()
        const xx = Math.round(x(t)) + 0.5
        ctx.strokeStyle = p.grid
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(xx, y(ALT_MAX))
        ctx.lineTo(xx, y(ALT_MIN) + (hour % 3 === 0 ? 4 : 2))
        ctx.stroke()
        if (hour % 3 === 0) {
          ctx.fillStyle = p.textDim
          ctx.fillText(`${String(hour).padStart(2, '0')}h`, xx, h - PAD.bottom + 6)
        }
      }

      // Courbes.
      const requests: LabelRequest[] = []
      for (const s of series) {
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.emphasis ? 2.2 : 1.4
        ctx.globalAlpha = s.emphasis ? 1 : 0.9
        ctx.beginPath()
        s.samples.forEach((pt, i) => {
          const px = x(pt.time.getTime())
          const py = y(pt.altitudeDeg)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
        const top = s.samples.reduce((a, b) => (b.altitudeDeg > a.altitudeDeg ? b : a), s.samples[0])
        if (top && top.altitudeDeg > 3) {
          ctx.font = labelFont(s)
          requests.push({
            id: s.id, x: x(top.time.getTime()), y: y(top.altitudeDeg), width: ctx.measureText(s.label).width,
            priority: s.emphasis ? -100 : (s.magnitude ?? 0),
          })
        }
      }
      ctx.globalAlpha = 1

      // Étiquettes sans chevauchement, trait de rappel si décalées.
      const placed = placeCurveLabels(requests, { left: PAD.left, right: width - PAD.right, top: PAD.top, bottom: y(ALT_MIN) })
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      for (const l of placed) {
        const s = series.find((it) => it.id === l.id)!
        const req = requests.find((r) => r.id === l.id)!
        if (l.leader) {
          const ly = l.baselineY < req.y ? l.baselineY + 2 : l.baselineY - 11
          ctx.strokeStyle = s.color
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 0.75
          ctx.beginPath()
          ctx.moveTo(req.x, req.y)
          ctx.lineTo(l.x, ly)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        ctx.font = labelFont(s)
        ctx.fillStyle = s.color
        ctx.fillText(s.label, l.x, l.baselineY)
      }

      // Curseur temps simulé.
      if (nowMs >= t0 && nowMs <= t1) {
        const xn = Math.round(x(nowMs)) + 0.5
        ctx.strokeStyle = p.accent
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(xn, PAD.top)
        ctx.lineTo(xn, y(ALT_MIN))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = p.accent
        ctx.beginPath()
        ctx.arc(xn, PAD.top, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [series, sun, nowMs, p],
  )

  return <canvas ref={ref} role="img" aria-label={ariaLabel} style={{ height }} className="block w-full" />
}
