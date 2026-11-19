/**
 * Fiche du passage sélectionné : compte à rebours synchronisé avec l'horloge de
 * simulation, lever / culmination / coucher, ombre de la Terre, magnitude et
 * envoi vers le planétarium.
 */
import { Navigation, Satellite } from 'lucide-react'
import { azimuthToCardinal } from '../../services/astroEngine'
import { countdownTo, formatCountdown } from '../../services/space/countdown'
import type { PassEvent, VisiblePass } from '../../types/orbital'
import { Card } from '../ui/Card'
import { passPhase } from './spaceFormat'
import { fmtDay, fmtDuration, fmtMag, fmtNumber, fmtTimeSec } from '../ui/format'

interface Props {
  pass: VisiblePass
  nowMs: number
  onPoint(): void
}


function Event({ label, ev, extra }: { label: string; ev: PassEvent; extra?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-soft px-2.5 py-2">
      <div className="text-[10px] tracking-[0.12em] text-tertiary uppercase">{label}</div>
      <div className="text-[15px] font-medium tabular-nums">{fmtTimeSec(ev.time)}</div>
      <div className="truncate text-[11px] text-secondary tabular-nums">
        {fmtNumber(ev.elevationDeg, 0)}° · {azimuthToCardinal(ev.azimuthDeg)} {fmtNumber(ev.azimuthDeg, 0)}°{extra ? ` · ${extra}` : ''}
      </div>
    </div>
  )
}

export function PassHero({ pass, nowMs, onPoint }: Props) {
  const phase = passPhase(pass, nowMs)
  const target = phase === 'visible' ? pass.visibleEnd.time.getTime() : pass.visibleStart.time.getTime()
  const cd = formatCountdown(countdownTo(target, nowMs))
  const headline =
    phase === 'visible' ? 'Visible maintenant · fin dans'
    : phase === 'upcoming' || phase === 'rising' ? 'Visible dans'
    : phase === 'eclipsed' ? 'Entré dans l’ombre de la Terre'
    : 'Passage terminé'
  const culmMag = pass.culmination.magnitude !== null ? `mag ${fmtMag(pass.culmination.magnitude)}` : 'dans l’ombre'

  return (
    <Card
      title={`Passage · ${fmtDay(pass.rise.time)}`}
      icon={<Satellite size={14} />}
      aside={<span className="text-[11px] text-secondary tabular-nums">NORAD {pass.noradId}</span>}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[22px] leading-tight font-semibold">{pass.name}</h2>
          <p className={`text-[12px] ${phase === 'visible' ? 'text-good' : 'text-secondary'}`} role="status" aria-live="off">{headline}</p>
        </div>
        {(phase === 'visible' || phase === 'upcoming' || phase === 'rising') && (
          <div className={`shrink-0 text-right text-[22px] font-semibold tabular-nums ${phase === 'visible' ? 'text-good' : 'text-accent'}`} aria-label={`Compte à rebours ${cd}`}>
            {cd}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Event label="Lever" ev={pass.rise} />
        <Event label="Culmination" ev={pass.culmination} extra={culmMag} />
        <Event label="Coucher" ev={pass.set} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {pass.shadowExit && <Event label="Sortie de l’ombre" ev={pass.shadowExit} />}
        {pass.shadowEntry && <Event label="Entrée dans l’ombre" ev={pass.shadowEntry} />}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px] tabular-nums">
        <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Hauteur max</dt><dd className="text-[17px] font-medium text-accent">{fmtNumber(pass.culmination.elevationDeg, 0)}°</dd></div>
        <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Éclat max</dt><dd className="text-[17px] font-medium">{pass.peakMagnitude !== null ? fmtMag(pass.peakMagnitude) : '—'}</dd></div>
        <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Visible</dt><dd className="text-[17px] font-medium">{fmtDuration(pass.visibleDurationSec / 60)}</dd></div>
      </dl>

      <button
        type="button"
        onClick={onPoint}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-[14px] font-semibold text-accent active:scale-[0.98]"
      >
        <Navigation size={16} aria-hidden /> Pointer dans le ciel
      </button>
      {phase === 'upcoming' || phase === 'rising' ? (
        <p className="mt-1.5 text-center text-[11px] text-tertiary tabular-nums">La simulation avance au début de la portion visible ({fmtTimeSec(pass.visibleStart.time)}).</p>
      ) : null}
    </Card>
  )
}
