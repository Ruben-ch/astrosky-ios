import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/geolocation', () => ({ Geolocation: {} }))

import { setCacheStorage } from '../cache'
import {
  MAX_RECENTS,
  addFavorite,
  findSameSite,
  listFavorites,
  listRecents,
  makeSavedSite,
  pushRecent,
  removeFavorite,
  toggleFavorite,
} from '../location/savedSites'
import { createMemoryStorage } from './memoryStorage'

const PIC = makeSavedSite({ latitudeDeg: 42.9364, longitudeDeg: 0.1411, elevationM: 2877 }, 'Pic du Midi', 'Hautes-Pyrénées', 1000)
const PARIS = makeSavedSite({ latitudeDeg: 48.8363, longitudeDeg: 2.3366, elevationM: 67 }, 'Observatoire de Paris', '', 2000)

beforeEach(() => setCacheStorage(createMemoryStorage()))

describe('sites enregistrés', () => {
  it('crée un site validé avec identifiant stable et nom par défaut', () => {
    expect(PIC.id).toBe('site:42.9364,0.1411')
    expect(makeSavedSite({ latitudeDeg: 0, longitudeDeg: 190, elevationM: 0 }, '  ').label).toBe('Site sans nom')
    expect(makeSavedSite({ latitudeDeg: 0, longitudeDeg: 190, elevationM: 0 }, 'x').longitudeDeg).toBe(-170)
    expect(() => makeSavedSite({ latitudeDeg: 95, longitudeDeg: 0, elevationM: 0 }, 'x')).toThrow()
  })

  it('ajoute, dédoublonne (< 500 m) et supprime des favoris', async () => {
    await addFavorite(PIC)
    await addFavorite(PARIS)
    const renamed = { ...PIC, label: 'Observatoire du Pic', latitudeDeg: PIC.latitudeDeg + 0.001 }
    const list = await addFavorite(renamed)
    expect(list.map((s) => s.label)).toEqual(['Observatoire du Pic', 'Observatoire de Paris'])
    expect(await removeFavorite(PARIS.id)).toHaveLength(1)
    expect(await listFavorites()).toHaveLength(1)
  })

  it('bascule l’état favori', async () => {
    expect(await toggleFavorite(PIC)).toHaveLength(1)
    expect(findSameSite(await listFavorites(), { latitudeDeg: 42.9365, longitudeDeg: 0.1412 })).toBeDefined()
    expect(await toggleFavorite(PIC)).toHaveLength(0)
  })

  it('plafonne les sites récents et place le dernier en tête', async () => {
    for (let i = 0; i < MAX_RECENTS + 3; i++) {
      await pushRecent(makeSavedSite({ latitudeDeg: 40 + i, longitudeDeg: 2, elevationM: 0 }, `S${i}`))
    }
    await pushRecent(makeSavedSite({ latitudeDeg: 48, longitudeDeg: 2, elevationM: 0 }, 'S8 bis'))
    const recents = await listRecents()
    expect(recents).toHaveLength(MAX_RECENTS)
    expect(recents[0].label).toBe('S8 bis')
    expect(recents.filter((s) => s.latitudeDeg === 48)).toHaveLength(1)
  })

  it('résiste à un stockage corrompu', async () => {
    const mem = createMemoryStorage()
    setCacheStorage(mem)
    mem.data.set('astrosky:sites:favorites', '{pas du json')
    expect(await listFavorites()).toEqual([])
  })
})
