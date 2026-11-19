/** Graphique horaire interactif des conditions + relevé détaillé de l'heure touchée. */
import { useState } from 'react'
import { useHiDpiCanvas } from '../../hooks/useHiDpiCanvas'
import { useTheme } from '../../hooks/useAppContext'
import { hapticTick } from '../../services/haptics'
import { DEW_LEVEL_FR } from '../../services/weather/nightSeries'
import type { WeatherPoint } from '../../types/tonight'
import { Readout } from '../ui/Card'
import { fmtNumber, fmtTime } from '../ui/format'
import { WEATHER_CHART_HEIGHT, columnIndexAtX, drawWeather } from './weatherDraw'

function nearestIndex(points: readonly WeatherPoint[], nowMs: number): number {
  let best = 0
  points.forEach((p, i) => {
    if (Math.abs(p.time.getTime() + 1_800_000 - nowMs) < Math.abs(points[best].time.getTime() + 1_800_000 - nowMs)) best = i
  })
  return best
}

/** `details` : affiche les relevés secondaires (températures, couches nuageuses) masqués derrière (i). */
export function WeatherChart({ points, nowMs, details = false }: { points: readonly WeatherPoint[]; nowMs: number; details?: boolean }) {
  const { palette: p } = useTheme()
  // Suit le temps simulé tant que l'utilisateur n'a pas touché le graphique.
  const [pinned, setPinned] = useState<number | null>(null)
  const index = Math.min(pinned ?? nearestIndex(points, nowMs), points.length - 1)

  const ref = useHiDpiCanvas((ctx, { width }) => drawWeather(ctx, width, points, index, nowMs, p), [points, index, nowMs, p])

  const pick = (clientX: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect()
    const i = columnIndexAtX(clientX - rect.left, rect.width, points.length)
    if (i !== index) void hapticTick()
    setPinned(i)
  }

  const pt = points[index]
  return (
    <div>
      <canvas
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Conditions heure par heure : nuages, seeing, transparence et rosée"
        aria-valuetext={pt ? `${fmtTime(pt.time)} : nuages ${pt.cloudCoverPct} %, seeing ${pt.pickering}/10` : undefined}
        style={{ height: WEATHER_CHART_HEIGHT }}
        className="block w-full touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e.clientX, e.currentTarget)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX, e.currentTarget)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setPinned(Math.min(points.length - 1, index + 1))
          if (e.key === 'ArrowLeft') setPinned(Math.max(0, index - 1))
        }}
      />
      {pt && (
        <div className="mt-4">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] items-end gap-3">
            <div className="pb-0.5 text-[15px] font-semibold text-primary tabular-nums">{fmtTime(pt.time)}</div>
            <Readout label="Nuages" value={`${pt.cloudCoverPct}`} unit="%" />
            <Readout label="Seeing" value={fmtNumber(pt.pickering, 1)} unit="/10" />
            <Readout label="Transp." value={`${pt.transparency}`} unit="/100" />
            <Readout label="Rosée" value={DEW_LEVEL_FR[pt.dewLevel]} tone={pt.dewLevel === 'high' || pt.dewLevel === 'moderate' ? 'text-fair' : undefined} />
          </div>
          {details && (
            <div className="mt-3 space-y-1 text-[12px] leading-snug text-secondary tabular-nums">
              <p>{fmtNumber(pt.temperatureC, 1)} °C · point de rosée {fmtNumber(pt.dewPointC, 1)} °C · vent {fmtNumber(pt.windSpeedKmh)} km/h</p>
              <p>Nuages bas {pt.cloudLowPct} % · moyens {pt.cloudMidPct} % · hauts {pt.cloudHighPct} % · turbulence {pt.seeingLabel} · écart T−Td {fmtNumber(pt.dewSpreadC, 1)} °C</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
