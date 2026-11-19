/**
 * Panneau de télémétrie de l'astre sélectionné : distances au Soleil et à la
 * Terre (UA et km), magnitude, diamètre apparent, élongation (matin / soir),
 * phase, obliquité, période et temps-lumière — recalculés avec le temps simulé.
 */
import { LocateFixed, X } from 'lucide-react'
import { useMemo } from 'react'
import { useSimTime } from '../../hooks/useSimTime'
import { getOrreryTelemetry } from '../../services/orrery/telemetry'
import type { OrreryBodyId, OrreryTelemetry } from '../../types/orrery'
import { fmtDeg, fmtMag } from '../ui/format'
import { fmtArcsec, fmtAu, fmtKm, fmtLightTime, fmtPeriod, fmtPhase } from './telemetryFormat'

const KIND_FR: Record<OrreryTelemetry['kind'], string> = { star: 'Étoile', planet: 'Planète', moon: 'Lune galiléenne · Jupiter' }

function Cell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[9.5px] tracking-[0.12em] text-tertiary uppercase">{label}</dt>
      <dd className={`truncate text-[15px] leading-tight font-medium tabular-nums ${tone ?? 'text-primary'}`}>{value}</dd>
      {sub && <dd className="truncate text-[10.5px] text-secondary tabular-nums">{sub}</dd>}
    </div>
  )
}

interface Props {
  id: OrreryBodyId
  focused: boolean
  onCenter(): void
  onClose(): void
}

export function TelemetryPanel({ id, focused, onCenter, onClose }: Props) {
  const now = useSimTime(400, 1000)
  const ms = now.getTime()
  const t = useMemo(() => getOrreryTelemetry(id, new Date(ms)), [id, ms])
  const vis = t.visibility === 'morning' ? 'ciel du matin' : t.visibility === 'evening' ? 'ciel du soir' : undefined
  const extra =
    t.ringTiltDeg !== null
      ? { label: 'Anneaux', value: fmtDeg(t.ringTiltDeg, 1), sub: 'inclinaison vue de la Terre' }
      : t.jupiterSeparationArcsec !== null
        ? { label: 'Écart à Jupiter', value: fmtArcsec(t.jupiterSeparationArcsec), sub: 'vu de la Terre' }
        : { label: 'Lumière', value: fmtLightTime(t.lightTimeMin), sub: t.lightTimeMin !== null ? 'jusqu’à la Terre' : undefined }

  return (
    <section data-orrery-hud className="pointer-events-auto rounded-3xl bg-elevated/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" aria-label={`Télémétrie : ${t.nameFr}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] leading-tight font-semibold">{t.nameFr}</h2>
          <p className="truncate text-[11.5px] text-secondary tabular-nums">
            {KIND_FR[t.kind]}
            {t.axialTiltDeg !== null && ` · axe ${fmtDeg(t.axialTiltDeg, 1)}`}
            {t.orbitalPeriodDays !== null && ` · période ${fmtPeriod(t.orbitalPeriodDays)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCenter}
          aria-pressed={focused}
          aria-label={`Centrer ${t.nameFr} dans la vue`}
          className={`touch-target -mt-1 flex items-center justify-center rounded-xl ${focused ? 'text-accent' : 'text-secondary'}`}
        >
          <LocateFixed size={18} />
        </button>
        <button type="button" onClick={onClose} aria-label="Fermer la télémétrie" className="touch-target -mt-1 -mr-2 flex items-center justify-center text-secondary">
          <X size={18} />
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
        <Cell label="Dist. Soleil" value={t.sunDistanceAu === null ? '—' : `${fmtAu(t.sunDistanceAu)} UA`} sub={t.sunDistanceAu === null ? undefined : fmtKm(t.sunDistanceAu)} />
        <Cell label="Dist. Terre" value={t.earthDistanceAu === null ? '—' : `${fmtAu(t.earthDistanceAu)} UA`} sub={t.earthDistanceAu === null ? undefined : fmtKm(t.earthDistanceAu)} />
        <Cell label="Magnitude" value={fmtMag(t.magnitude)} tone={t.magnitude !== null ? 'text-accent' : 'text-secondary'} sub={t.magnitude === null && t.kind === 'moon' ? 'non modélisée' : undefined} />
        <Cell label="Diam. apparent" value={fmtArcsec(t.angularDiameterArcsec)} />
        <Cell label="Élongation" value={t.elongationDeg === null ? '—' : fmtDeg(t.elongationDeg, 1)} sub={vis} />
        <Cell label="Phase" value={fmtPhase(t.phaseFraction)} sub={t.phaseAngleDeg !== null ? `angle ${fmtDeg(t.phaseAngleDeg, 1)}` : undefined} />
      </dl>
      <p className="mt-2 flex items-baseline gap-1.5 border-t border-hairline pt-2 text-[11px] text-secondary tabular-nums">
        <span className="text-[9.5px] tracking-[0.12em] text-tertiary uppercase">{extra.label}</span>
        <span className="font-medium text-primary">{extra.value}</span>
        {extra.sub && <span className="truncate">{extra.sub}</span>}
      </p>
    </section>
  )
}
