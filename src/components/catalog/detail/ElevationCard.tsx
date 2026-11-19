/**
 * Carte « Cette nuit » de la fiche : courbe d'élévation nocturne, lever /
 * passage au méridien / coucher précis et relevés heure par heure défilables.
 */
import { TrendingUp } from 'lucide-react'
import { useTheme } from '../../../hooks/useAppContext'
import { useHiDpiCanvas } from '../../../hooks/useHiDpiCanvas'
import { azimuthToCardinal } from '../../../services/astroEngine'
import { OBSERVABLE_MIN_ALT_DEG } from '../../../services/catalog/filters'
import type { NightElevationProfile } from '../../../types/encyclopedia'
import { Card, Readout } from '../../ui/Card'
import { fmtDuration, fmtNumber, fmtTime } from '../../ui/format'
import { drawElevation } from './elevationDraw'

interface Props {
  profile: NightElevationProfile
  nowMs: number
  label: string
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' })

function EventReadout({ label, time, sub }: { label: string; time: Date | null; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] tracking-[0.12em] text-tertiary uppercase">{label}</div>
      <div className="text-[17px] font-medium tabular-nums">{fmtTime(time)}</div>
      <div className="truncate text-[10px] text-secondary tabular-nums">{sub ?? (time ? dayFmt.format(time).replace('.', '') : ' ')}</div>
    </div>
  )
}

export function ElevationCard({ profile, nowMs, label }: Props) {
  const { palette: p } = useTheme()
  const ref = useHiDpiCanvas((ctx, { width, height }) => drawElevation(ctx, width, height, profile, nowMs, OBSERVABLE_MIN_ALT_DEG, p), [profile, nowMs, p])
  const rts = profile.riseTransitSet
  const c = profile.culmination
  const status = rts.alwaysUp ? 'Circumpolaire' : rts.alwaysDown ? 'Ne se lève pas' : null

  return (
    <Card title="Élévation cette nuit" icon={<TrendingUp size={14} />} aside={status && <span className="text-[11px] font-semibold text-accent">{status}</span>}>
      <canvas ref={ref} role="img" aria-label={`Courbe d’élévation de ${label} : culmination à ${fmtTime(c.time)}, ${fmtNumber(c.altitudeDeg, 0)}°`} className="-mx-1 block h-[190px] w-[calc(100%+0.5rem)]" />
      <div className="mt-3 grid grid-cols-4 gap-2">
        <EventReadout label="Lever" time={rts.rise} sub={rts.alwaysUp ? 'toujours levé' : undefined} />
        <EventReadout label="Méridien" time={rts.transit} sub={rts.transitAltitudeDeg !== null ? `${fmtNumber(rts.transitAltitudeDeg, 1)}°` : undefined} />
        <EventReadout label="Coucher" time={rts.set} sub={rts.alwaysUp ? 'jamais couché' : undefined} />
        <Readout label="> 15° nuit" value={fmtDuration(profile.observableDarkMinutes)} />
      </div>
      <p className="mt-2 text-[12px] text-secondary tabular-nums">
        Culmination de la nuit à <span className="text-primary">{fmtTime(c.time)}</span>, {fmtNumber(c.altitudeDeg, 1)}° de hauteur
        {c.duringDarkness ? ' en nuit noire.' : ' (hors nuit noire).'}
      </p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4" data-h-scroll role="list" aria-label="Hauteur heure par heure">
        {profile.hourly.map((h) => {
          const observable = h.altitudeDeg > OBSERVABLE_MIN_ALT_DEG
          return (
            <div
              key={h.time.getTime()}
              role="listitem"
              className={`flex w-12 shrink-0 flex-col items-center rounded-lg border py-1.5 tabular-nums ${h.dark ? 'border-subtle bg-bg-primary' : 'border-transparent bg-elevated'}`}
            >
              <span className="text-[10px] text-tertiary">{String(h.time.getHours()).padStart(2, '0')}h</span>
              <span className={`text-[14px] font-semibold ${observable ? 'text-accent' : h.altitudeDeg > 0 ? 'text-primary' : 'text-tertiary'}`}>
                {fmtNumber(h.altitudeDeg, 0)}°
              </span>
              <span className="text-[10px] text-secondary">{azimuthToCardinal(h.azimuthDeg)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
