/**
 * Carte « Conditions d'observation » (Open-Meteo) : score moyen de la nuit,
 * meilleure heure, puis graphiques horaires seeing / transparence / nuages /
 * rosée. Cache 1 h, repli hors-ligne sur la dernière prévision connue.
 */
import { CloudMoon, Droplets, Info, RefreshCw, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { NightData } from '../../hooks/useNightData'
import { moonConditionAt } from '../../hooks/useNightData'
import { useAsync } from '../../hooks/useAsync'
import { useTheme } from '../../hooks/useAppContext'
import { getDarkWindow } from '../../services/astroEngine'
import { buildNightSeries, weatherWindow } from '../../services/weather/nightSeries'
import { bestObservingHour, loadForecast, nightAverageScore, scoreForecast } from '../../services/weatherService'
import { scoreColor } from '../../theme/palette'
import { Badge, Card } from '../ui/Card'
import { fmtTime } from '../ui/format'
import { WeatherChart } from './WeatherChart'

export function WeatherCard({ data }: { data: NightData }) {
  const { palette: p } = useTheme()
  const { loc, now, summary } = data
  const forecast = useAsync(() => loadForecast(loc), [loc])
  const [info, setInfo] = useState(false)
  const nowMs = now.getTime()
  const nightStartMs = summary.nightStart.getTime()

  const win = useMemo(() => getDarkWindow(new Date(nightStartMs + 43_200_000), loc), [nightStartMs, loc])
  const scores = useMemo(
    () => (forecast.data ? scoreForecast(forecast.data.hours, (t) => moonConditionAt(t, loc)) : []),
    [forecast.data, loc],
  )
  const { sunset, sunrise } = summary.twilight
  const series = useMemo(() => {
    if (!forecast.data) return []
    const w = weatherWindow(sunset, sunrise, new Date(nightStartMs), new Date(nightStartMs + 86_400_000))
    return buildNightSeries(forecast.data.hours, w.start, w.end, (t) => moonConditionAt(t, loc))
  }, [forecast.data, sunset, sunrise, nightStartMs, loc])

  const avg = nightAverageScore(scores, win.start, win.end)
  const best = bestObservingHour(scores, win.start, win.end)
  const dewHours = series.filter((s) => s.time >= win.start && s.time <= win.end && (s.dewLevel === 'high' || s.dewLevel === 'moderate')).length
  const offline = forecast.data?.origin === 'stale-cache'

  const aside = (
    <div className="-mr-3 flex items-center">
      {offline && (
        <Badge tone="text-fair">
          <WifiOff size={10} /> MAJ {fmtTime(new Date(forecast.data!.fetchedAt))}
        </Badge>
      )}
      <button type="button" onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="Détails et sources des prévisions" className={`touch-target flex items-center justify-center ${info ? 'text-accent' : 'text-tertiary'}`}>
        <Info size={16} />
      </button>
      <button type="button" onClick={forecast.reload} aria-label="Actualiser la météo" className="touch-target flex items-center justify-center text-tertiary">
        <RefreshCw size={15} className={forecast.loading ? 'animate-spin' : ''} />
      </button>
    </div>
  )

  return (
    <Card title="Conditions d'observation" icon={<CloudMoon size={15} />} aside={aside}>
      {forecast.error && !forecast.data ? (
        <p className="py-3 text-[13px] text-secondary">Météo indisponible hors-ligne : aucune prévision en cache pour ce site.</p>
      ) : !forecast.data ? (
        <div className="h-[200px] animate-pulse rounded-xl bg-elevated" aria-label="Chargement des prévisions" />
      ) : series.length === 0 ? (
        <p className="py-3 text-[13px] text-secondary">Pas de prévision horaire disponible pour cette nuit (horizon de 3 jours).</p>
      ) : (
        <>
          <div className="mb-5 flex items-end gap-4">
            <div>
              <div className="flex items-baseline text-[44px] leading-none font-semibold tracking-tight text-primary tabular-nums">
                <span className="mr-2 size-3 self-center rounded-full" style={{ background: scoreColor(avg ?? 0, p) }} aria-hidden />
                {avg ?? '—'}
                <span className="ml-1 text-[15px] text-secondary">/100</span>
              </div>
              <div className="mt-1.5 text-[12px] text-secondary">Score moyen de la nuit noire</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11px] text-tertiary">Meilleure heure</div>
              <div className="text-[20px] font-medium tabular-nums">{best ? fmtTime(best.time) : '—'}</div>
              {best && <div className="text-[12px] text-secondary tabular-nums">score {best.overall}</div>}
            </div>
          </div>
          {dewHours > 0 && (
            <div className="mb-4">
              <Badge tone="text-fair">
                <Droplets size={10} /> Rosée probable {dewHours} h · résistance chauffante conseillée
              </Badge>
            </div>
          )}
          <WeatherChart points={series} nowMs={nowMs} details={info} />
          {info && <p className="mt-2 text-[12px] leading-snug text-tertiary">Prévisions Open-Meteo · seeing estimé (jet-stream 250 hPa, vent) · pondération lunaire.</p>}
        </>
      )}
    </Card>
  )
}
