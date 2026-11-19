/**
 * Objets de contexte React et leurs contrats, séparés des fournisseurs pour
 * préserver le Fast Refresh (un fichier de composants n'exporte que des composants).
 */
import { createContext } from 'react'
import type { ObserverLocation } from '../types/astro'
import type { ClockAnchor, LocationPermission, ResolvedLocation } from '../types/services'
import type { RenderPalette, ThemeName } from '../theme/palette'
import type { CatalogFocus, TabId } from '../types/navigation'

export interface SimulationApi {
  /** Temps simulé courant (ms) — lecture sans re-rendu, à appeler dans une boucle rAF. */
  getSimMs(): number
  readonly anchor: ClockAnchor
  readonly rate: number
  setRate(rate: number): void
  shiftBy(deltaMs: number): void
  jumpTo(simMs: number): void
  goLive(): void
  isLive(): boolean
}

export interface ObserverApi {
  readonly location: ResolvedLocation
  readonly permission: LocationPermission
  readonly locating: boolean
  readonly error: string | null
  refreshGps(): Promise<void>
  pinManual(loc: ObserverLocation, label: string): Promise<void>
  /** Épingle un site choisi (ville, favori, récent) et le mémorise dans les récents. */
  selectSite(loc: ObserverLocation, label: string, detail?: string): Promise<void>
  unpinManual(): Promise<void>
}

export interface ThemeApi {
  readonly theme: ThemeName
  readonly palette: RenderPalette
  setTheme(theme: ThemeName): void
  toggleRedNight(): void
}

export interface NavigationApi {
  readonly tab: TabId
  navigate(tab: TabId): void
  /** Bascule sur le Catalogue et y verrouille la cible `key`. */
  focusInCatalog(key: string): void
  readonly catalogFocus: CatalogFocus | null
  /** Acquitte une demande de verrouillage traitée. */
  clearCatalogFocus(nonce: number): void
  /** Bascule sur le planétarium et y lance le guidage vers `key`. */
  guideInSky(key: string): void
  readonly skyFocus: CatalogFocus | null
  clearSkyFocus(nonce: number): void
  /** Plein écran du planétarium : en-tête, machine temporelle et onglets masqués. */
  readonly immersive: boolean
  setImmersive(on: boolean): void
}

export const NavigationContext = createContext<NavigationApi | null>(null)
export const SimulationContext = createContext<SimulationApi | null>(null)
export const ObserverContext = createContext<ObserverApi | null>(null)
export const ThemeContext = createContext<ThemeApi | null>(null)
