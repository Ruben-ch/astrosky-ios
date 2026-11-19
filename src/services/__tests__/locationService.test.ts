import { beforeEach, describe, expect, it, vi } from 'vitest'

const geo = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}))
vi.mock('@capacitor/geolocation', () => ({ Geolocation: geo }))

import { setCacheStorage } from '../cache'
import {
  DEFAULT_LOCATION,
  LocationValidationError,
  acquireGpsLocation,
  clearManualLocation,
  formatLatitude,
  formatLongitude,
  getLocationPermission,
  maidenheadLocator,
  requestLocationPermission,
  resolveLocation,
  setManualLocation,
  validateLocation,
} from '../locationService'
import { createMemoryStorage } from './memoryStorage'

const gpsFix = {
  timestamp: 1_700_000_000_000,
  coords: { latitude: 43.7, longitude: 7.27, altitude: 120, accuracy: 8 },
}

describe('locationService', () => {
  beforeEach(() => {
    setCacheStorage(createMemoryStorage())
    vi.resetAllMocks()
  })

  it('valide et normalise les coordonnées', () => {
    expect(validateLocation({ latitudeDeg: 10, longitudeDeg: 190, elevationM: 0 }).longitudeDeg).toBe(-170)
    expect(validateLocation({ latitudeDeg: 10, longitudeDeg: -180, elevationM: 0 }).longitudeDeg).toBe(-180)
    expect(() => validateLocation({ latitudeDeg: 91, longitudeDeg: 0, elevationM: 0 })).toThrow(LocationValidationError)
    expect(() => validateLocation({ latitudeDeg: NaN, longitudeDeg: 0, elevationM: 0 })).toThrow(LocationValidationError)
    expect(() => validateLocation({ latitudeDeg: 0, longitudeDeg: 0, elevationM: 12_000 })).toThrow(LocationValidationError)
  })

  it('acquiert une position GPS et la met en cache', async () => {
    geo.getCurrentPosition.mockResolvedValue(gpsFix)
    const loc = await acquireGpsLocation()
    expect(loc).toMatchObject({ latitudeDeg: 43.7, longitudeDeg: 7.27, elevationM: 120, source: 'gps', accuracyM: 8 })
    geo.getCurrentPosition.mockRejectedValue(new Error('denied'))
    const fallback = await resolveLocation()
    expect(fallback.source).toBe('cache')
    expect(fallback.latitudeDeg).toBe(43.7)
  })

  it('se rabat sur le site par défaut sans GPS ni cache', async () => {
    geo.getCurrentPosition.mockRejectedValue(new Error('timeout'))
    expect(await resolveLocation()).toEqual(DEFAULT_LOCATION)
    expect(await resolveLocation({ useGps: false })).toEqual(DEFAULT_LOCATION)
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('donne priorité à la position manuelle épinglée', async () => {
    geo.getCurrentPosition.mockResolvedValue(gpsFix)
    await setManualLocation({ latitudeDeg: 42.94, longitudeDeg: 0.14, elevationM: 2877 }, 'Pic du Midi')
    const loc = await resolveLocation()
    expect(loc.source).toBe('manual')
    expect(loc.label).toBe('Pic du Midi')
    expect(geo.getCurrentPosition).not.toHaveBeenCalled()
    await clearManualLocation()
    expect((await resolveLocation()).source).toBe('gps')
  })

  it('traduit les permissions et tolère leur absence', async () => {
    geo.checkPermissions.mockResolvedValue({ location: 'prompt-with-rationale', coarseLocation: 'prompt' })
    expect(await getLocationPermission()).toBe('prompt')
    geo.checkPermissions.mockRejectedValue(new Error('Not implemented'))
    expect(await getLocationPermission()).toBe('unavailable')
    geo.requestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' })
    expect(await requestLocationPermission()).toBe('granted')
    geo.requestPermissions.mockRejectedValue(new Error('Not implemented on web'))
    expect(await requestLocationPermission()).toBe('prompt')
  })

  it('formate en DMS et en localisateur Maidenhead', () => {
    expect(formatLatitude(48.8363)).toBe('48° 50′ 11″ N')
    expect(formatLongitude(-0.5)).toBe('0° 30′ 00″ O')
    expect(maidenheadLocator(48.8363, 2.3366)).toBe('JN18eu')
    expect(maidenheadLocator(-33.8688, 151.2093)).toBe('QF56od')
  })
})
