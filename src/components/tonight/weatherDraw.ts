/**
 * Dessin Canvas 2D des conditions horaires : couches nuageuses (carte de
 * chaleur basse/moyenne/haute), seeing (Pickering), transparence, risque de
 * rosée, heure sélectionnée et curseur du temps simulé. Palette injectée.
 */
import type { RenderPalette } from '../../theme/palette'
import type { WeatherPoint } from '../../types/tonight'

export const WEATHER_GUTTER = 50
const RIGHT = 2
const LANES = [
  { id: 'cloud', label: 'Nuages', h: 33 },
  { id: 'seeing', label: 'Seeing', h: 26 },
  { id: 'transparency', label: 'Transp.', h: 26 },
  { id: 'dew', label: 'Rosée', h: 26 },
] as const
const GAP = 7
const AXIS_H = 14
export const WEATHER_CHART_HEIGHT = LANES.reduce((s, l) => s + l.h + GAP, 0) + AXIS_H

const HOUR = 3_600_000

export function columnIndexAtX(px: number, width: number, count: number): number {
  const colW = (width - WEATHER_GUTTER - RIGHT) / count
  return Math.min(count - 1, Math.max(0, Math.floor((px - WEATHER_GUTTER) / colW)))
}

export function drawWeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  points: readonly WeatherPoint[],
  selected: number,
  nowMs: number,
  p: RenderPalette,
): void {
  if (points.length === 0) return
  const colW = (width - WEATHER_GUTTER - RIGHT) / points.length
  const xCol = (i: number) => WEATHER_GUTTER + i * colW
  const total = WEATHER_CHART_HEIGHT - AXIS_H

  // Colonne sélectionnée.
  ctx.fillStyle = p.chart.selection
  ctx.fillRect(xCol(selected), 0, colW, total)

  ctx.font = '500 10px -apple-system, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  let top = 0
  for (const lane of LANES) {
    ctx.fillStyle = p.textDim
    ctx.textAlign = 'left'
    ctx.fillText(lane.label, 0, top + lane.h / 2)
    ctx.strokeStyle = p.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(WEATHER_GUTTER, top + lane.h + 0.5)
    ctx.lineTo(width - RIGHT, top + lane.h + 0.5)
    ctx.stroke()

    points.forEach((pt, i) => {
      const x0 = xCol(i) + 1
      const w = Math.max(1, colW - 2)
      if (lane.id === 'cloud') {
        // Trois rangées : haute (en haut), moyenne, basse — opacité = couverture.
        const rowH = (lane.h - 4) / 3
        const rows = [
          [pt.cloudHighPct, p.chart.cloudHigh],
          [pt.cloudMidPct, p.chart.cloudMid],
          [pt.cloudLowPct, p.chart.cloudLow],
        ] as const
        rows.forEach(([pct, color], r) => {
          ctx.globalAlpha = 0.08 + 0.92 * (pct / 100)
          ctx.fillStyle = color
          ctx.fillRect(x0, top + 1 + r * (rowH + 1), w, rowH)
        })
        ctx.globalAlpha = 1
        return
      }
      const value = lane.id === 'seeing' ? pt.pickering / 10 : lane.id === 'transparency' ? pt.transparency / 100 : pt.dewRisk / 100
      const color = lane.id === 'seeing' ? p.chart.seeing : lane.id === 'transparency' ? p.chart.transparency : p.chart.dew
      const h = Math.max(1.5, value * (lane.h - 3))
      ctx.globalAlpha = lane.id === 'dew' ? 0.35 + 0.65 * value : 0.55 + 0.45 * value
      ctx.fillStyle = color
      ctx.fillRect(x0, top + lane.h - h, w, h)
      ctx.globalAlpha = 1
    })
    top += lane.h + GAP
  }

  // Axe horaire.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '500 9px -apple-system, system-ui, sans-serif'
  const every = points.length > 14 ? 3 : 2
  points.forEach((pt, i) => {
    const hour = pt.time.getHours()
    if (hour % every !== 0) return
    ctx.fillStyle = i === selected ? p.accent : p.textDim
    ctx.fillText(`${String(hour).padStart(2, '0')}h`, xCol(i) + colW / 2, total + 2)
  })

  // Curseur du temps simulé.
  const t0 = points[0].time.getTime()
  const t1 = points[points.length - 1].time.getTime() + HOUR
  if (nowMs >= t0 && nowMs < t1) {
    const xn = Math.round(WEATHER_GUTTER + ((nowMs - t0) / (t1 - t0)) * (width - WEATHER_GUTTER - RIGHT)) + 0.5
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(xn, 0)
    ctx.lineTo(xn, total)
    ctx.stroke()
    ctx.setLineDash([])
  }
}
