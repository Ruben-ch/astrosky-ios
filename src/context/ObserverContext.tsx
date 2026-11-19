/**
 * Position de l'observateur partagée par toute l'application.
 * Résolution au montage (GPS si autorisé) avec repli cache/défaut immédiat.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ObserverContext, type ObserverApi } from './contexts'
import type { LocationPermission, ResolvedLocation } from '../types/services'
import type { ObserverLocation } from '../types/astro'
import {
  DEFAULT_LOCATION,
  acquireGpsLocation,
  clearManualLocation,
  getLastKnownLocation,
  getLocationPermission,
  getManualLocation,
  requestLocationPermission,
  setManualLocation,
} from '../services/locationService'
import { hapticSuccess, hapticWarning } from '../services/haptics'
import { loadCityCatalog, nearestCity } from '../services/location/citySearch'
import { makeSavedSite, pushRecent } from '../services/location/savedSites'

/** Distance maximale pour nommer une position GPS d'après la ville la plus proche. */
const NAMING_RADIUS_KM = 25

/** Nomme une position GPS hors-ligne (« GPS · près de Lyon »), sans jamais échouer. */
async function withCityLabel(loc: ResolvedLocation): Promise<ResolvedLocation> {
  try {
    const near = nearestCity(await loadCityCatalog(), loc)
    if (!near || near.distanceKm > NAMING_RADIUS_KM) return loc
    return { ...loc, label: near.distanceKm < 3 ? `GPS · ${near.city.name}` : `GPS · près de ${near.city.name}` }
  } catch {
    return loc
  }
}

export function ObserverProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<ResolvedLocation>(DEFAULT_LOCATION)
  const [permission, setPermission] = useState<LocationPermission>('prompt')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshGps = useCallback(async () => {
    setLocating(true)
    setError(null)
    try {
      const perm = await requestLocationPermission()
      setPermission(perm)
      setLocation(await withCityLabel(await acquireGpsLocation()))
      setPermission('granted')
      void hapticSuccess()
    } catch {
      setError('Position GPS indisponible — dernière position connue utilisée')
      setPermission(await getLocationPermission())
      void hapticWarning()
    } finally {
      setLocating(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const manual = await getManualLocation()
      if (manual) {
        if (!cancelled) setLocation(manual)
        return
      }
      const last = await getLastKnownLocation()
      if (last && !cancelled) setLocation(last)
      const perm = await getLocationPermission()
      if (cancelled) return
      setPermission(perm)
      if (perm === 'granted') {
        setLocating(true)
        try {
          const gps = await withCityLabel(await acquireGpsLocation())
          if (!cancelled) setLocation(gps)
        } catch {
          /* on conserve le repli */
        } finally {
          if (!cancelled) setLocating(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pinManual = useCallback(async (loc: ObserverLocation, label: string) => {
    setLocation(await setManualLocation(loc, label))
    setError(null)
    void hapticSuccess()
  }, [])

  const selectSite = useCallback(async (loc: ObserverLocation, label: string, detail = '') => {
    setLocation(await setManualLocation(loc, label))
    setError(null)
    void hapticSuccess()
    await pushRecent(makeSavedSite(loc, label, detail))
  }, [])

  const unpinManual = useCallback(async () => {
    await clearManualLocation()
    setLocation((await getLastKnownLocation()) ?? DEFAULT_LOCATION)
  }, [])

  const api = useMemo<ObserverApi>(
    () => ({ location, permission, locating, error, refreshGps, pinManual, selectSite, unpinManual }),
    [location, permission, locating, error, refreshGps, pinManual, selectSite, unpinManual],
  )
  return <ObserverContext.Provider value={api}>{children}</ObserverContext.Provider>
}
