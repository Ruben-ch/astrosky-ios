/** Ligne de catalogue : code ou pastille, nom, sous-titre, magnitude / taille et position actuelle. */
import { ChevronRight } from 'lucide-react'
import { azimuthToCardinal } from '../../services/astroEngine'
import { OBSERVABLE_MIN_ALT_DEG } from '../../services/catalog/filters'
import { fmtMag, fmtNumber } from '../ui/format'

interface Props {
  rowKey: string
  code: string
  name: string
  subtitle: string
  mag: number | null
  /** Taille du grand axe en minutes d'arc (ciel profond). */
  sizeArcmin?: number | null
  swatch?: string
  altitudeDeg: number
  azimuthDeg: number
  onSelect(): void
}

const fmtSize = (a: number) => (a >= 60 ? `${fmtNumber(a / 60, 1)}°` : `${fmtNumber(a, a < 10 ? 1 : 0)}′`)

export function CatalogRow({ rowKey, code, name, subtitle, mag, sizeArcmin, swatch, altitudeDeg, azimuthDeg, onSelect }: Props) {
  const up = altitudeDeg > 0
  const observable = altitudeDeg > OBSERVABLE_MIN_ALT_DEG
  return (
    <li data-key={rowKey} className="border-b border-hairline">
      <button type="button" onClick={onSelect} aria-label={`${code === name ? name : `${code} ${name}`}, hauteur ${Math.round(altitudeDeg)}°`} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-soft">
        {swatch && (
          <span className="flex w-4 shrink-0 justify-center" aria-hidden>
            <span className="size-2.5 rounded-full" style={{ background: swatch }} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          {!swatch && code !== name && <span className="block text-[11px] leading-tight font-semibold tracking-wide text-accent tabular-nums">{code}</span>}
          <span className={`line-clamp-2 text-[15px] leading-snug font-medium break-words ${up ? 'text-primary' : 'text-secondary'}`}>{name}</span>
          <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-tertiary">{subtitle}</span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-[12px] whitespace-nowrap text-secondary">
            mag {fmtMag(mag)}
            {sizeArcmin != null && <span className="text-tertiary"> · {fmtSize(sizeArcmin)}</span>}
          </span>
          <span className="mt-0.5 block text-[14px] font-medium whitespace-nowrap">
            <span className={observable ? 'text-accent' : up ? 'text-primary' : 'text-tertiary'}>{fmtNumber(altitudeDeg, 0)}°</span>{' '}
            <span className="text-[12px] font-normal text-tertiary">{azimuthToCardinal(azimuthDeg)}</span>
          </span>
        </span>
        <ChevronRight size={16} className="-mr-1 shrink-0 text-tertiary" aria-hidden />
      </button>
    </li>
  )
}
