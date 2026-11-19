/**
 * Barre d'onglets iOS : cibles ≥ 44 px, indicateur glissant, haptique au
 * changement, retour en haut au second toucher, safe-area basse respectée.
 */
import type { LucideIcon } from 'lucide-react'
import { hapticSelection, hapticTick } from '../../services/haptics'

export interface TabDef<T extends string> {
  readonly id: T
  readonly label: string
  readonly icon: LucideIcon
}

interface TabBarProps<T extends string> {
  tabs: readonly TabDef<T>[]
  active: T
  onChange(id: T): void
  /** Toucher l'onglet déjà actif (retour en haut). */
  onReselect?(): void
}

export function TabBar<T extends string>({ tabs, active, onChange, onReselect }: TabBarProps<T>) {
  const index = Math.max(0, tabs.findIndex((t) => t.id === active))
  return (
    <nav className="pb-safe relative border-t border-hairline bg-bg-primary" aria-label="Navigation principale">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-0.5 rounded-full bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${100 / tabs.length}%`, transform: `translateX(${index * 100}%) scaleX(0.4)` }}
      />
      <div className="flex" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = id === active
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={label}
              onClick={() => {
                if (selected) {
                  onReselect?.()
                  void hapticTick()
                  return
                }
                onChange(id)
                void hapticSelection()
              }}
              className={`flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:opacity-70 ${
                selected ? 'text-accent' : 'text-tertiary'
              }`}
            >
              <span className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${selected ? 'bg-accent-soft' : ''}`}>
                <Icon size={21} strokeWidth={selected ? 2.2 : 1.7} aria-hidden />
              </span>
              <span className={`text-[10px] tracking-wide ${selected ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
