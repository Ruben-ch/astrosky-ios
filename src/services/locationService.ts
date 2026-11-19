/**
 * Service de localisation de l'observateur.
 * Ordre de résolution : position manuelle épinglée → GPS → dernière position
 * connue (cache, valide 30 jours) → site par défaut (Observatoire de Paris).
 * Fonctionne entièrement hors-ligne : aucune géolocalisation inverse réseau.
 */
import { Geolocation } from '@capacitor/geolocation'
import type { ObserverLocation } from '../types/astro'
import type { LocationPermission, ResolvedLocation } from '../types/services'
import { cacheGet, cacheReadStale, cacheRemove, cacheSet } from './cache'

const LAST_KEY = 'location:last'
const MANUAL_KEY = 'location:manual'
const LAST_TTL_MS = 30 * 86_400_000
const MANUAL_TTL_MS = 10 * 365 * 86_400_000

export const DEFAULT_LOCATION: ResolvedLocation = {
  latitudeDeg: 48.8363,
  longitudeDeg: 2.3366,
  elevationM: 67,
  source: 'default',
  accuracyM: null,
  acquiredAt: 0,
  label: 'Observatoire de Paris',
}

export class LocationValidationError extends Error {}

/** Vérifie et normalise une position (longitude ramenée dans [−180, 180[). */
export function validateLocation(loc: ObserverLocation): ObserverLocation {
  const { latitudeDeg, longitudeDeg, elevationM } = loc
  if (![latitudeDeg, longitudeDeg, elevationM].every(Number.isFinite)) {
    throw new LocationValidationError('Coordonnées non numériques')
  }
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new LocationValidationError('Latitude hors de [−90°, 90°]')
  if (elevationM < -500 || elevationM > 9000) throw new LocationValidationError('Altitude hors de [−500 m, 9000 m]')
  const lonNorm = longitudeDeg >= -180 && longitudeDeg < 180 ? longitudeDeg : ((((longitudeDeg + 180) % 360) + 360) % 360) - 180
  return { latitudeDeg, longitudeDeg: lonNorm, elevationM }
}

export async function getLocationPermission(): Promise<LocationPermission> {
  try {
    const status = await Geolocation.checkPermissions()
    return status.location === 'prompt-with-rationale' ? 'prompt' : status.location
  } catch {
    return 'unavailable'
  }
}

export async function requestLocationPermission(): Promise<LocationPermission> {
  try {
    const status = await Geolocation.requestPermissions({ permissions: ['location'] })
    return status.location === 'prompt-with-rationale' ? 'prompt' : status.location
  } catch {
    // Sur le web, requestPermissions n'est pas implémenté : la demande se fait
    // implicitement au premier getCurrentPosition.
    return 'prompt'
  }
}

/** Acquisition GPS ponctuelle. Lève une erreur si refusée ou expirée. */
export async function acquireGpsLocation(timeoutMs = 12_000): Promise<ResolvedLocation> {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: timeoutMs,
    maximumAge: 5 * 60_000,
  })
  const loc = validateLocation({
    latitudeDeg: pos.coords.latitude,
    longitudeDeg: pos.coords.longitude,
    elevationM: pos.coords.altitude ?? 0,
  })
  const resolved: ResolvedLocation = {
    ...loc,
    source: 'gps',
    accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    acquiredAt: pos.timestamp || Date.now(),
    label: 'Position GPS',
  }
  await cacheSet(LAST_KEY, resolved, LAST_TTL_MS)
  return resolved
}

export async function getManualLocation(): Promise<ResolvedLocation | null> {
  return cacheGet<ResolvedLocation>(MANUAL_KEY)
}

/** Épingle un site d'observation manuel prioritaire sur le GPS. */
export async function setManualLocation(loc: ObserverLocation, label = 'Site manuel'): Promise<ResolvedLocation> {
  const valid = validateLocation(loc)
  const resolved: ResolvedLocation = { ...valid, source: 'manual', accuracyM: null, acquiredAt: Date.now(), label }
  await cacheSet(MANUAL_KEY, resolved, MANUAL_TTL_MS)
  return resolved
}

export async function clearManualLocation(): Promise<void> {
  await cacheRemove(MANUAL_KEY)
}

export async function getLastKnownLocation(): Promise<ResolvedLocation | null> {
  const entry = await cacheReadStale<ResolvedLocation>(LAST_KEY)
  return entry ? { ...entry.value, source: 'cache', label: 'Dernière position connue' } : null
}

/**
 * Résout la meilleure position disponible sans jamais échouer.
 * @param useGps tenter une acquisition GPS si aucune position manuelle n'est épinglée.
 */
export async function resolveLocation(options: { useGps?: boolean; timeoutMs?: number } = {}): Promise<ResolvedLocation> {
  const manual = await getManualLocation()
  if (manual) return manual
  if (options.useGps !== false) {
    try {
      return await acquireGpsLocation(options.timeoutMs)
    } catch {
      /* refus, absence de signal ou délai : on se rabat sur le cache */
    }
  }
  return (await getLastKnownLocation()) ?? DEFAULT_LOCATION
}

/** Formate un angle en degrés-minutes-secondes : `48° 50′ 11″ N`. */
export function formatDms(valueDeg: number, positive: string, negative: string): string {
  const hemi = valueDeg >= 0 ? positive : negative
  let totalSec = Math.round(Math.abs(valueDeg) * 3600)
  const d = Math.floor(totalSec / 3600)
  totalSec -= d * 3600
  const m = Math.floor(totalSec / 60)
  const s = totalSec - m * 60
  return `${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″ ${hemi}`
}

export const formatLatitude = (latDeg: number) => formatDms(latDeg, 'N', 'S')
export const formatLongitude = (lonDeg: number) => formatDms(lonDeg, 'E', 'O')

/** Localisateur Maidenhead à 6 caractères (ex. `JN18eu`), utile aux radioamateurs. */
export function maidenheadLocator(latDeg: number, lonDeg: number): string {
  const lon = Math.min(lonDeg + 180, 359.999999)
  const lat = Math.min(latDeg + 90, 179.999999)
  const A = 'A'.charCodeAt(0)
  const a = 'a'.charCodeAt(0)
  return (
    String.fromCharCode(A + Math.floor(lon / 20)) +
    String.fromCharCode(A + Math.floor(lat / 10)) +
    String(Math.floor((lon % 20) / 2)) +
    String(Math.floor(lat % 10)) +
    String.fromCharCode(a + Math.floor(((lon % 2) * 60) / 5)) +
    String.fromCharCode(a + Math.floor(((lat % 1) * 60) / 2.5))
  )
}
