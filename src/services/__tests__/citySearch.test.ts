import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CITY_REGIONS, CITY_ROWS } from '../../data/cities.generated'
import { setCacheStorage } from '../cache'
import {
  buildCityCatalog,
  buildGeocodingUrl,
  cityDetail,
  loadCityCatalog,
  matchRank,
  mergeCityResults,
  nearestCity,
  parseGeocoding,
  searchCities,
  searchOffline,
  type GeocodingResponse,
} from '../location/citySearch'
import { countryNameFr, haversineKm, normalizeText, siteIdFor } from '../location/geodesy'
import type { CityResult } from '../../types/location'
import { createMemoryStorage } from './memoryStorage'

const catalog = buildCityCatalog(CITY_ROWS, CITY_REGIONS)

const online: GeocodingResponse = {
  results: [
    { id: 2643743, name: 'Londres', latitude: 51.50853, longitude: -0.12574, elevation: 25, country_code: 'GB', country: 'Royaume-Uni', admin1: 'Angleterre', population: 8961989 },
    { id: 6058560, name: 'London', latitude: 42.98339, longitude: -81.23304, elevation: 252, country_code: 'CA', country: 'Canada', admin1: 'Ontario', population: 346765 },
    { id: 1, name: '', latitude: 0, longitude: 0 },
  ],
}

const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch
const failingFetch = vi.fn(async () => {
  throw new TypeError('Failed to fetch')
}) as unknown as typeof fetch

beforeEach(() => setCacheStorage(createMemoryStorage()))

describe('géodésie et texte', () => {
  it('normalise accents, ligatures et ponctuation', () => {
    expect(normalizeText('Saint-Étienne')).toBe('saint etienne')
    expect(normalizeText('  Œuilly  ')).toBe('oeuilly')
    expect(normalizeText("L'Haÿ-les-Roses")).toBe('l hay les roses')
  })

  it('distance Paris → Lyon ≈ 392 km', () => {
    const km = haversineKm({ latitudeDeg: 48.8566, longitudeDeg: 2.3522 }, { latitudeDeg: 45.764, longitudeDeg: 4.8357 })
    expect(km).toBeGreaterThan(385)
    expect(km).toBeLessThan(400)
  })

  it('noms de pays en français et identifiant de site stable', () => {
    expect(countryNameFr('DE')).toBe('Allemagne')
    expect(siteIdFor({ latitudeDeg: 48.85661, longitudeDeg: 2.35222 })).toBe('site:48.8566,2.3522')
  })
})

describe('catalogue GeoNames embarqué', () => {
  it('contient plus de 4000 villes valides triées par population', () => {
    expect(CITY_ROWS.length).toBeGreaterThan(4000)
    for (let i = 0; i < CITY_ROWS.length; i++) {
      const [, name, cc, region, lat, lon, , pop] = CITY_ROWS[i]
      expect(name.length).toBeGreaterThan(0)
      expect(cc).toMatch(/^[A-Z]{2}$/)
      expect(region).toBeLessThan(CITY_REGIONS.length)
      expect(Math.abs(lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(lon)).toBeLessThanOrEqual(180)
      if (i > 0) expect(pop).toBeLessThanOrEqual(CITY_ROWS[i - 1][7])
    }
  })

  it('se charge à la demande une seule fois', async () => {
    const a = await loadCityCatalog()
    const b = await loadCityCatalog()
    expect(a).toBe(b)
    expect(a.rows.length).toBe(CITY_ROWS.length)
  })
})

describe('recherche hors-ligne', () => {
  it('classe exact > préfixe > mot > sous-chaîne', () => {
    expect(matchRank('lyon', 'lyon')).toBe(4)
    expect(matchRank('lyonnais', 'lyon')).toBe(3)
    expect(matchRank('saint etienne', 'etienne')).toBe(2)
    expect(matchRank('marseille', 'seil')).toBe(1)
    expect(matchRank('nice', 'lyon')).toBe(0)
  })

  it('trouve Paris (France) en tête, avec région et altitude', () => {
    const [first] = searchOffline(catalog, 'paris')
    expect(first.name).toBe('Paris')
    expect(first.countryCode).toBe('FR')
    expect(first.region).toBe('Île-de-France')
    expect(first.latitudeDeg).toBeCloseTo(48.853, 2)
    expect(first.source).toBe('offline')
  })

  it('ignore accents et tirets', () => {
    const res = searchOffline(catalog, 'saint etienne')
    expect(res.some((c) => c.name === 'Saint-Étienne' && c.countryCode === 'FR')).toBe(true)
  })

  it('refuse les requêtes trop courtes et respecte la limite', () => {
    expect(searchOffline(catalog, 'p')).toEqual([])
    expect(searchOffline(catalog, 'san', 5)).toHaveLength(5)
  })

  it('nomme une position GPS par la ville la plus proche', () => {
    const near = nearestCity(catalog, { latitudeDeg: 45.76, longitudeDeg: 4.86 })
    expect(near?.city.name).toBe('Lyon')
    expect(near!.distanceKm).toBeLessThan(5)
  })
})

describe('géocodage Open-Meteo', () => {
  it('construit une URL en français', () => {
    const url = new URL(buildGeocodingUrl(' Londres '))
    expect(url.origin + url.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search')
    expect(url.searchParams.get('name')).toBe('Londres')
    expect(url.searchParams.get('language')).toBe('fr')
  })

  it('analyse la réponse et écarte les entrées invalides', () => {
    const res = parseGeocoding(online)
    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({ id: 'geonames:2643743', name: 'Londres', countryCode: 'GB', elevationM: 25, source: 'online' })
    expect(parseGeocoding({})).toEqual([])
  })

  it('fusionne sans doublon (même id GeoNames ou même nom à < 5 km)', () => {
    const a = parseGeocoding(online)
    const dupById: CityResult = { ...a[1], source: 'offline' }
    const dupByPlace: CityResult = { ...a[0], id: 'geonames:999', name: 'LONDRES', latitudeDeg: 51.51, source: 'offline' }
    const other: CityResult = { ...a[0], id: 'geonames:2', name: 'Lens', latitudeDeg: 50.43, longitudeDeg: 2.83, source: 'offline' }
    const merged = mergeCityResults(a, [dupById, dupByPlace, other])
    expect(merged.map((c) => c.name)).toEqual(['Londres', 'London', 'Lens'])
  })

  it('combine en ligne + hors-ligne puis sert le cache', async () => {
    const f = okFetch(online)
    const res = await searchCities('Londres', { fetchImpl: f, catalog })
    expect(res.mode).toBe('online')
    expect(res.results[0].name).toBe('Londres')
    await searchCities('londres', { fetchImpl: f, catalog })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('bascule sur le catalogue embarqué hors-ligne', async () => {
    const res = await searchCities('Lyon', { fetchImpl: failingFetch, catalog })
    expect(res.mode).toBe('offline')
    expect(res.results[0].name).toBe('Lyon')
  })

  it('libellé secondaire sans répétition', () => {
    expect(cityDetail({ name: 'Paris', region: 'Île-de-France', country: 'France' })).toBe('Île-de-France, France')
    expect(cityDetail({ name: 'Monaco', region: 'Monaco', country: 'Monaco' })).toBe('')
  })
})
