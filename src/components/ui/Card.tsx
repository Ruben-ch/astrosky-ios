/**
 * Carte instrument au style iOS (Météo / Sky Guide) : surface douce sans bordure
 * sur fond OLED, marges généreuses, en-tête discret en petites capitales.
 */
import type { ReactNode } from 'react'

interface CardProps {
  title: string
  icon?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, icon, aside, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-[22px] bg-soft ${className}`}>
      <header className="flex min-h-11 items-center gap-2 px-5 pt-3">
        {icon && <span className="text-secondary" aria-hidden>{icon}</span>}
        <h2 className="min-w-0 flex-1 text-[11px] font-semibold tracking-[0.07em] text-secondary uppercase">{title}</h2>
        {aside}
      </header>
      <div className="px-5 pt-1 pb-5">{children}</div>
    </section>
  )
}

/** Valeur numérique étiquetée, alignée en chiffres tabulaires. */
export function Readout({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-tertiary">{label}</div>
      <div className={`truncate text-[17px] font-medium tabular-nums ${tone ?? 'text-primary'}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs text-secondary">{unit}</span>}
      </div>
    </div>
  )
}

/** Pastille d'état discrète (origine des données, hors-ligne…). */
export function Badge({ children, tone = 'text-secondary' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-softer px-2 py-0.5 text-[10px] font-medium tracking-wide tabular-nums ${tone}`}>
      {children}
    </span>
  )
}
