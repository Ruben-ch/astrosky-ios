/**
 * Ligne du classement des cibles : rang, nom complet (1 à 2 lignes, jamais
 * tronqué), sous-titre type · constellation · magnitude, puis note et
 * culmination alignées à droite ; toucher = verrouiller dans le Catalogue.
 */
import { ChevronRight } from 'lucide-react'
import type { RankedTarget } from '../../types/tonight'
import { fmtMag, fmtNumber, fmtTime } from '../ui/format'

export function TargetRow({ target, rank, onLock }: { target: RankedTarget; rank: number; onLock(): void }) {
  const t = target
  const title = t.name === t.code ? t.name : `${t.code} · ${t.name}`
  const moonNear = t.tags.includes('moon-near')
  return (
    <li className="border-b border-hairline last:border-0">
      <button
        type="button"
        onClick={onLock}
        aria-label={`Verrouiller ${title} dans le catalogue`}
        className="flex min-h-14 w-full items-center gap-3 py-3.5 text-left active:opacity-70"
      >
        <span className="w-5 shrink-0 self-start pt-px text-center text-[13px] font-semibold text-tertiary tabular-nums">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] leading-snug font-medium break-words">{title}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-secondary tabular-nums">
            {t.typeLabel} · {t.constellation} · mag {fmtMag(t.magnitude)}
            {moonNear && <span className="text-fair"> · près de la Lune</span>}
          </span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-[17px] leading-tight font-semibold text-accent">{t.score}</span>
          <span className="block text-[11px] text-tertiary">
            {fmtNumber(t.maxAltitudeDeg, 0)}° · {fmtTime(t.bestTime)}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-tertiary" aria-hidden />
      </button>
    </li>
  )
}
