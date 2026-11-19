/** Accès typés aux contextes globaux (lèvent une erreur hors fournisseur). */
import { useContext } from 'react'
import {
  NavigationContext,
  ObserverContext,
  SimulationContext,
  ThemeContext,
  type NavigationApi,
  type ObserverApi,
  type SimulationApi,
  type ThemeApi,
} from '../context/contexts'

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} utilisé hors de son fournisseur`)
  return value
}

export const useSimulation = (): SimulationApi => required(useContext(SimulationContext), 'SimulationContext')
export const useObserver = (): ObserverApi => required(useContext(ObserverContext), 'ObserverContext')
export const useTheme = (): ThemeApi => required(useContext(ThemeContext), 'ThemeContext')
export const useNavigation = (): NavigationApi => required(useContext(NavigationContext), 'NavigationContext')
