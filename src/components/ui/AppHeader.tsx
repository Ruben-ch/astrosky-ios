/**
 * En-tête compact sur une seule ligne : titre de l'onglet, pilule du site
 * d'observation (ouvre la feuille « Site d'observation ») et bascule vision nocturne.
 * Les coordonnées brutes restent consultables dans la feuille de lieu.
 */
import { ChevronDown, Eye, EyeOff, LocateFixed, MapPin, Navigation } from 'lucide-react'
import { useObserver, useTheme } from '../../hooks/useAppContext'
import { formatLatitude, formatLongitude } from '../../services/locationService'

export function AppHeader({ title, onOpenLocation }: { title: string; onOpenLocation(): void }) {
  const { location, locating } = useObserver()
  const { theme, toggleRedNight } = useTheme()
  const red = theme === 'red-night'
  const SourceIcon = locating ? LocateFixed : location.source === 'gps' ? Navigation : MapPin

  return (
    <header className="pt-safe bg-bg-primary">
      <div className="flex min-h-[52px] items-center gap-2 pr-3 pl-4">
        <h1 className="shrink-0 text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
        <div className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenLocation}
            className="flex min-h-11 max-w-full min-w-11 items-center active:opacity-70"
            aria-label={`Site d'observation : ${location.label} (${formatLatitude(location.latitudeDeg)} ${formatLongitude(location.longitudeDeg)}). Modifier`}
          >
            <span className="flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-softer px-3 text-[13px] font-medium text-primary">
              <SourceIcon size={13} className={`shrink-0 text-accent ${locating ? 'animate-pulse' : ''}`} aria-hidden />
              <span className="truncate">{location.label}</span>
              <ChevronDown size={13} className="shrink-0 text-secondary" aria-hidden />
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={toggleRedNight}
          aria-pressed={red}
          aria-label={red ? 'Désactiver la vision nocturne rouge' : 'Activer la vision nocturne rouge'}
          className="flex min-h-11 shrink-0 items-center active:scale-[0.97]"
        >
          <span
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold tracking-wide transition-colors ${
              red ? 'bg-accent-soft text-accent' : 'bg-softer text-secondary'
            }`}
          >
            {red ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
            Nuit
          </span>
        </button>
      </div>
    </header>
  )
}
