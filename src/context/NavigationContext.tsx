/**
 * Navigation entre onglets et demandes de verrouillage d'une cible dans le
 * Catalogue (depuis « Ce soir »). L'onglet initial peut venir de `?tab=`.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavigationContext, type NavigationApi } from './contexts'
import { TAB_IDS, type CatalogFocus, type TabId } from '../types/navigation'
import { hapticLock } from '../services/haptics'

function initialTab(): TabId {
  try {
    const t = new URLSearchParams(globalThis.location?.search ?? '').get('tab')
    return TAB_IDS.find((id) => id === t) ?? 'tonight'
  } catch {
    return 'tonight'
  }
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>(initialTab)
  const [catalogFocus, setCatalogFocus] = useState<CatalogFocus | null>(null)
  const [skyFocus, setSkyFocus] = useState<CatalogFocus | null>(null)
  const [immersive, setImmersiveState] = useState(false)
  const nonceRef = useRef(0)

  const focusInCatalog = useCallback((key: string) => {
    nonceRef.current += 1
    setCatalogFocus({ key, nonce: nonceRef.current })
    setTab('catalog')
    setImmersiveState(false)
    void hapticLock()
  }, [])

  const clearCatalogFocus = useCallback((nonce: number) => {
    setCatalogFocus((f) => (f?.nonce === nonce ? null : f))
  }, [])

  const guideInSky = useCallback((key: string) => {
    nonceRef.current += 1
    setSkyFocus({ key, nonce: nonceRef.current })
    setTab('sky')
    void hapticLock()
  }, [])

  const clearSkyFocus = useCallback((nonce: number) => {
    setSkyFocus((f) => (f?.nonce === nonce ? null : f))
  }, [])

  const navigate = useCallback((next: TabId) => {
    setTab(next)
    if (next !== 'sky') setImmersiveState(false)
  }, [])

  const setImmersive = useCallback((on: boolean) => setImmersiveState(on), [])

  const api = useMemo<NavigationApi>(
    () => ({ tab, navigate, focusInCatalog, catalogFocus, clearCatalogFocus, guideInSky, skyFocus, clearSkyFocus, immersive, setImmersive }),
    [tab, navigate, focusInCatalog, catalogFocus, clearCatalogFocus, guideInSky, skyFocus, clearSkyFocus, immersive, setImmersive],
  )
  return <NavigationContext.Provider value={api}>{children}</NavigationContext.Provider>
}
