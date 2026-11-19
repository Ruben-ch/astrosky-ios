/**
 * Carte « Lune » détaillée : rendu de phase, illumination, âge sur la lunaison,
 * lever / culmination / coucher de la nuit, prochaines pleine et nouvelle lune
 * (touchables pour y voyager), courbe de lunaison et géométrie.
 */
import { MoonStar } from 'lucide-react'
import { useSimulation } from '../../hooks/useAppContext'
import { azimuthToCardinal } from '../../services/astroEngine'
import { hapticSelection } from '../../services/haptics'
import type { MoonDetail } from '../../types/tonight'
import { Card, Readout } from '../ui/Card'
import { fmtDay, fmtNumber, fmtRelative, fmtTime } from '../ui/format'
import { LunationStrip } from './LunationStrip'
import { MoonPhaseCanvas } from './MoonPhaseCanvas'

export function MoonDetailCard({ moon, now, latitudeDeg }: { moon: MoonDetail; now: Date; latitudeDeg: number }) {
  const sim = useSimulation()
  const up = moon.altitudeDeg > 0
  const upcoming = [
    { label: 'Pleine lune', time: moon.nextFullMoon },
    { label: 'Nouvelle lune', time: moon.nextNewMoon },
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  return (
    <Card title="Lune" icon={<MoonStar size={15} />} aside={<span className="text-[12px] text-secondary tabular-nums">{moon.constellation}</span>}>
      <div className="flex items-center gap-4">
        <MoonPhaseCanvas phaseAngleDeg={moon.phaseAngleDeg} size={92} southern={latitudeDeg < 0} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{moon.phaseNameFr}</div>
          <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-[34px] leading-none font-semibold">{fmtNumber(moon.illuminatedFraction * 100)}</span>
            <span className="text-[13px] text-secondary">% éclairée</span>
          </div>
          <div className="mt-1 text-[12px] text-secondary tabular-nums">
            Âge {fmtNumber(moon.ageDays, 1)} j / {fmtNumber(moon.lunationDays, 1)} j ·{' '}
            <span className={up ? 'text-accent' : ''}>{up ? `levée ${fmtNumber(moon.altitudeDeg, 0)}° ${azimuthToCardinal(moon.azimuthDeg)}` : 'sous l’horizon'}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-hairline pt-4">
        <Readout label="Lever" value={fmtTime(moon.rise)} />
        <Readout label="Culmin." value={fmtTime(moon.transit)} unit={moon.transitAltitudeDeg !== null ? ` ${fmtNumber(moon.transitAltitudeDeg, 0)}°` : undefined} />
        <Readout label="Coucher" value={fmtTime(moon.set)} />
      </div>

      <div className="mt-5">
        <LunationStrip moon={moon} nowMs={now.getTime()} />
        <div className="mt-1.5 flex justify-between text-[11px] text-tertiary tabular-nums">
          <span>NL {fmtDay(moon.previousNewMoon)}</span>
          <span>PL {fmtDay(moon.nextFullMoon)}</span>
          <span>NL {fmtDay(moon.nextNewMoon)}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {upcoming.map((u) => (
          <button
            key={u.label}
            type="button"
            onClick={() => {
              sim.jumpTo(u.time.getTime())
              void hapticSelection()
            }}
            aria-label={`Aller à la prochaine ${u.label.toLowerCase()} : ${fmtDay(u.time)} ${fmtTime(u.time)}`}
            className="min-h-11 rounded-2xl bg-softer px-3.5 py-2.5 text-left active:scale-[0.98]"
          >
            <span className="block text-[11px] text-tertiary">{u.label}</span>
            <span className="block text-[15px] font-medium tabular-nums">{fmtDay(u.time)}</span>
            <span className="block text-[11px] text-secondary tabular-nums">
              {fmtTime(u.time)} · <span className="text-accent">{fmtRelative(u.time, now)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 text-[12px] text-tertiary tabular-nums">
        Distance {fmtNumber(moon.distanceKm)} km · diamètre {fmtNumber(moon.angularDiameterArcmin, 1)}′
      </div>
    </Card>
  )
}
