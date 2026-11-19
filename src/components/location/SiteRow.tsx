/** Ligne de site (ville, favori, récent) : sélection au toucher et étoile de favori. */
import { Star, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtNumber } from '../ui/format'

interface Props {
  title: string
  detail: string
  elevationM: number
  icon: ReactNode
  favorite: boolean
  current?: boolean
  onSelect(): void
  onToggleFavorite(): void
  onRemove?(): void
}

export function SiteRow({ title, detail, elevationM, icon, favorite, current, onSelect, onToggleFavorite, onRemove }: Props) {
  return (
    <li className="flex items-center border-b border-hairline last:border-0">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Choisir ${title}${detail ? `, ${detail}` : ''}`}
        aria-current={current ? 'location' : undefined}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left active:opacity-70"
      >
        <span className={`shrink-0 ${current ? 'text-accent' : 'text-tertiary'}`} aria-hidden>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-medium ${current ? 'text-accent' : 'text-primary'}`}>{title}</span>
          <span className="block truncate text-[11px] text-secondary">{detail || '—'}</span>
        </span>
        <span className="shrink-0 text-[11px] text-tertiary tabular-nums">{fmtNumber(elevationM)} m</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Supprimer ${title} des favoris`} className="touch-target flex items-center justify-center text-tertiary">
          <Trash2 size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Retirer ${title} des favoris` : `Ajouter ${title} aux favoris`}
        className={`touch-target -mr-2 flex items-center justify-center ${favorite ? 'text-accent' : 'text-tertiary'}`}
      >
        <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </li>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-1">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-secondary uppercase">{children}</h3>
      {aside}
    </div>
  )
}
