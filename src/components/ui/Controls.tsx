/**
 * Contrôles tactiles partagés (cibles ≥ 44 px, chiffres tabulaires, haptique) :
 * sélecteur segmenté, puce bascule et stepper numérique avec saisie directe.
 * Aucun contrôle natif (select) : les sélecteurs système iOS ignorent le thème red-night.
 */
import { Minus, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { hapticSelection } from '../../services/haptics'

interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: readonly { id: T; label: ReactNode; ariaLabel?: string }[]
  onChange(v: T): void
  className?: string
}

export function Segmented<T extends string | number>({ label, value, options, onChange, className = '' }: SegmentedProps<T>) {
  return (
    <div
      className={`grid gap-1 rounded-2xl bg-soft p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-label={o.ariaLabel}
          onClick={() => {
            if (value !== o.id) void hapticSelection()
            onChange(o.id)
          }}
          className={`min-h-11 min-w-11 rounded-xl px-1 text-[12px] font-semibold tabular-nums ${value === o.id ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ChipProps {
  active: boolean
  onToggle(): void
  children: ReactNode
  ariaLabel?: string
  role?: 'switch' | 'radio' | 'checkbox'
}

export function Chip({ active, onToggle, children, ariaLabel, role = 'checkbox' }: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={active}
      aria-label={ariaLabel}
      onClick={() => {
        void hapticSelection()
        onToggle()
      }}
      className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap tabular-nums ${active ? 'bg-accent-soft text-accent' : 'bg-soft text-secondary'}`}
    >
      {children}
    </button>
  )
}

interface StepperProps {
  label: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  digits?: number
  onChange(v: number): void
}

const fmt = (v: number, digits: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits })

/** Stepper − valeur + ; la valeur est aussi saisissable au clavier numérique (bornée à la validation). */
export function Stepper({ label, value, unit, step, min, max, digits = 0, onChange }: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = () => {
    if (draft === null) return
    const v = Number(draft.replace(',', '.'))
    if (Number.isFinite(v)) onChange(clamp(v))
    setDraft(null)
  }
  const bump = (dir: 1 | -1) => {
    void hapticSelection()
    const snapped = Math.round((value + dir * step) / step) * step
    onChange(clamp(Number(snapped.toFixed(4))))
  }
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] tracking-[0.12em] text-tertiary uppercase">{label}</div>
      <div className="flex items-center rounded-2xl bg-soft">
        <button type="button" onClick={() => bump(-1)} disabled={value <= min} aria-label={`${label} : diminuer`} className="flex size-11 shrink-0 items-center justify-center text-secondary disabled:opacity-40">
          <Minus size={16} />
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center gap-0.5">
          <span className="sr-only">{label}</span>
          <input
            inputMode="decimal"
            value={draft ?? fmt(value, digits)}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-11 w-11 min-w-0 flex-1 bg-transparent text-center text-[15px] font-medium text-primary tabular-nums outline-none"
          />
          <span className="shrink-0 text-[11px] text-secondary">{unit}</span>
        </label>
        <button type="button" onClick={() => bump(1)} disabled={value >= max} aria-label={`${label} : augmenter`} className="flex size-11 shrink-0 items-center justify-center text-secondary disabled:opacity-40">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
