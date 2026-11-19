/** Carte d'un lancement : compte à rebours, lanceur, pas de tir, statut et mission dépliable. */
import { ChevronDown, MapPin, Rocket } from 'lucide-react'
import { countdownTo, formatCountdown, formatCountdownShort } from '../../../services/space/countdown'
import type { Launch } from '../../../types/space'
import { fmtDay, fmtNumber, fmtTime } from '../../ui/format'
import { STATUS_TONE, providerShort } from '../spaceFormat'


const precisionText = (l: Launch) => (l.netPrecision && !/^(Hour|Minute)$/i.test(l.netPrecision) ? `date à préciser (${l.netPrecision === 'Month' ? 'mois' : l.netPrecision === 'Day' ? 'jour' : l.netPrecision.toLowerCase()})` : null)

interface Props {
  launch: Launch
  nowMs: number
  expanded: boolean
  onToggle(): void
  hero?: boolean
}

export function LaunchCard({ launch: l, nowMs, expanded, onToggle, hero = false }: Props) {
  const cd = countdownTo(l.net.getTime(), nowMs)
  const vague = precisionText(l)
  return (
    <article className={`rounded-[22px] ${hero ? 'bg-softer' : 'bg-soft'}`} aria-label={`Lancement ${l.name}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full px-4 py-4 text-left">
        <span className="flex items-start gap-3">
          <Rocket size={hero ? 20 : 16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className={`line-clamp-2 font-semibold break-words ${hero ? 'text-[19px] leading-tight' : 'text-[15px] leading-snug'}`}>{l.missionName}</span>
            <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-secondary">{l.rocket} · {providerShort(l.provider)}</span>
            <span className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-tertiary">
              <MapPin size={11} className="mt-[3px] shrink-0" aria-hidden />
              <span className="line-clamp-2">{l.pad}{l.location ? ` · ${l.location.split(',')[0]}` : ''}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${STATUS_TONE[l.status]}`} title={l.statusDescription ?? undefined}>{l.statusLabel}</span>
            <ChevronDown size={16} className={`shrink-0 text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </span>
        <span className={`mt-3 flex items-baseline justify-between gap-3 tabular-nums ${hero ? 'pl-8' : 'pl-7'}`}>
          {hero ? (
            <span className="text-[24px] leading-none font-semibold text-accent" aria-label={`Compte à rebours ${formatCountdown(cd)}`}>{formatCountdown(cd)}</span>
          ) : (
            <span className="text-[14px] font-semibold">{vague ? fmtDay(l.net) : `${fmtDay(l.net)} ${fmtTime(l.net)}`}</span>
          )}
          <span className="text-right text-[12px] text-tertiary">{vague ?? (hero ? `${fmtDay(l.net)} · ${fmtTime(l.net)}` : formatCountdownShort(cd))}</span>
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          {l.imageUrl && (
            <img src={l.imageUrl} alt={`Lanceur ${l.rocket}`} loading="lazy" className="h-36 w-full rounded-2xl object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
          )}
          <p className="text-[13px] leading-snug text-secondary">{l.missionDescription ?? 'Description de mission non publiée.'}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] tabular-nums">
            <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Fenêtre</dt><dd>{l.windowStart && l.windowEnd ? `${fmtTime(l.windowStart)} – ${fmtTime(l.windowEnd)}` : '—'}</dd></div>
            <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Orbite</dt><dd className="truncate">{l.orbit ?? '—'}</dd></div>
            <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Type</dt><dd className="truncate">{l.missionType ?? '—'}</dd></div>
            <div><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Météo favorable</dt><dd>{l.probabilityPct !== null ? `${fmtNumber(l.probabilityPct, 0)} %` : '—'}</dd></div>
            <div className="col-span-2"><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Opérateur</dt><dd className="truncate">{l.provider}</dd></div>
            {l.padLatitudeDeg !== null && l.padLongitudeDeg !== null && (
              <div className="col-span-2"><dt className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Pas de tir</dt><dd>{fmtNumber(l.padLatitudeDeg, 3)}°, {fmtNumber(l.padLongitudeDeg, 3)}° · {l.countryCode ?? ''}</dd></div>
            )}
          </dl>
          {l.statusDescription && <p className="text-[11px] text-tertiary">Statut : {l.statusDescription}{l.holdReason ? ` — ${l.holdReason}` : ''}</p>}
        </div>
      )}
    </article>
  )
}
