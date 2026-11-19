import { beforeEach, describe, expect, it } from 'vitest'
import { createSkyProjector } from '../astroEngine'
import { setCacheStorage } from '../cache'
import { loadCatalogFilters, sanitizeFilters, saveCatalogFilters } from '../catalog/catalogSettings'
import { findDeepSkyEntry, getDeepSkyEntries, groupCounts } from '../catalog/entries'
import { DEFAULT_FILTERS, OBSERVABLE_MIN_ALT_DEG, activeFilterCount, applyCatalogFilters, toggleIn } from '../catalog/filters'
import { normalizeText, parseDesignation, scoreEntry, searchEntries } from '../catalog/search'
import { createMemoryStorage } from './memoryStorage'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const NOW = new Date('2026-11-18T21:00:00Z')
const entries = getDeepSkyEntries()
const ids = (q: string) => searchEntries(entries, q).sort((a, b) => b.score - a.score).map((r) => r.entry.object.id)

describe('entrées enrichies', () => {
  it('couvre les 160 objets avec code, constellation et familles', () => {
    expect(entries).toHaveLength(160)
    const m31 = findDeepSkyEntry('M31')!
    expect(m31).toMatchObject({ code: 'M31', aliases: ['NGC 224'], group: 'galaxy', constellationFr: 'Andromède', positionAngleDeg: 35 })
    expect(m31.sources).toEqual(['messier', 'ngc'])
    expect(findDeepSkyEntry('IC434')!.sources).toEqual(['ic'])
    expect(findDeepSkyEntry('M40')!.group).toBeNull()
    const counts = groupCounts(entries)
    expect(counts.galaxy).toBeGreaterThan(40)
    expect(counts['supernova-remnant']).toBeGreaterThanOrEqual(3)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(160)
  })

  it('brillance de surface mesurée (OpenNGC) sinon calculée', () => {
    const m31 = findDeepSkyEntry('M31')!
    expect(m31.surfaceBrightnessOrigin).toBe('measured')
    expect(m31.surfaceBrightness).toBeCloseTo(23.63, 2)
    const m42 = findDeepSkyEntry('M42')!
    expect(m42.surfaceBrightnessOrigin).toBe('computed')
    expect(m42.surfaceBrightness!).toBeGreaterThan(18)
    expect(m42.surfaceBrightness!).toBeLessThan(24)
    for (const e of entries) {
      if (e.surfaceBrightness !== null) expect(e.surfaceBrightness).toBeGreaterThan(10)
      if (e.positionAngleDeg !== null) expect(e.positionAngleDeg).toBeLessThanOrEqual(180)
    }
  })
})

describe('recherche instantanée', () => {
  it('normalise accents, ligatures et ponctuation', () => {
    expect(normalizeText("  Galaxie d'Andromède ")).toBe('galaxie d andromede')
    expect(normalizeText('Œil-de-chat')).toBe('oeil de chat')
  })

  it('reconnaît les désignations', () => {
    expect(parseDesignation('M42')).toEqual({ catalog: 'm', number: 42 })
    expect(parseDesignation('messier 42')).toEqual({ catalog: 'm', number: 42 })
    expect(parseDesignation('ngc7000')).toEqual({ catalog: 'ngc', number: 7000 })
    expect(parseDesignation('IC 434')).toEqual({ catalog: 'ic', number: 434 })
    expect(parseDesignation('42')).toEqual({ catalog: null, number: 42 })
    expect(parseDesignation('orion')).toBeNull()
  })

  it('trouve par numéro Messier, NGC ou IC (exact en tête)', () => {
    expect(ids('M42')[0]).toBe('M42')
    expect(ids('m 4')[0]).toBe('M4')
    expect(ids('m 4')).toContain('M45')
    expect(ids('NGC 224')[0]).toBe('M31')
    expect(ids('ngc7000')[0]).toBe('NGC7000')
    expect(ids('IC434')).toEqual(['IC434'])
    expect(ids('31')[0]).toBe('M31')
    expect(ids('M999')).toEqual([])
  })

  it('trouve par nom usuel sans accents et par constellation', () => {
    expect(ids('andromede')[0]).toBe('M31')
    expect(ids('pleiades')[0]).toBe('M45')
    expect(ids('voile')).toEqual(expect.arrayContaining(['NGC6992']))
    const orion = ids('Orion')
    expect(orion).toEqual(expect.arrayContaining(['M42', 'M43', 'M78', 'NGC2024']))
    expect(ids('ori')).toEqual(expect.arrayContaining(['M42']))
    expect(ids('galaxie tourbillon')[0]).toBe('M51')
    expect(scoreEntry(findDeepSkyEntry('M31')!, 'xyzzy')).toBe(0)
  })
})

describe('filtres combinables', () => {
  const project = createSkyProjector(NOW, PARIS)

  it('sans filtre : tout le catalogue trié par hauteur', () => {
    const rows = applyCatalogFilters(entries, '', DEFAULT_FILTERS, project)
    expect(rows).toHaveLength(160)
    for (let i = 1; i < rows.length; i++) expect(rows[i].altitudeDeg).toBeLessThanOrEqual(rows[i - 1].altitudeDeg)
  })

  it('combine familles, catalogue et magnitude limite', () => {
    const f = { ...DEFAULT_FILTERS, groups: ['galaxy' as const, 'planetary-nebula' as const], sources: ['ngc' as const], magLimit: 9 }
    const rows = applyCatalogFilters(entries, '', f, project)
    expect(rows.length).toBeGreaterThan(5)
    for (const r of rows) {
      expect(['galaxy', 'planetary-nebula']).toContain(r.entry.group)
      expect(r.entry.sources).toContain('ngc')
      expect(r.entry.object.mag!).toBeLessThanOrEqual(9)
    }
    expect(rows.some((r) => r.entry.object.id === 'M31')).toBe(true)
    expect(activeFilterCount(f)).toBe(3)
  })

  it('« Observable maintenant » : hauteur > 15° à l’heure simulée', () => {
    const rows = applyCatalogFilters(entries, '', { ...DEFAULT_FILTERS, observableNow: true }, project)
    expect(rows.length).toBeGreaterThan(20)
    expect(rows.length).toBeLessThan(160)
    for (const r of rows) expect(r.altitudeDeg).toBeGreaterThan(OBSERVABLE_MIN_ALT_DEG)
    expect(rows.some((r) => r.entry.object.id === 'M31')).toBe(true) // haute en novembre au soir
    expect(rows.some((r) => r.entry.object.id === 'NGC104')).toBe(false) // 47 Tuc jamais levé à Paris
  })

  it('trie par éclat, numéro ou taille ; la pertinence prime avec une requête', () => {
    const byMag = applyCatalogFilters(entries, '', { ...DEFAULT_FILTERS, sort: 'magnitude' }, project)
    expect(byMag[0].entry.object.mag!).toBeLessThan(2)
    const byNum = applyCatalogFilters(entries, '', { ...DEFAULT_FILTERS, sort: 'catalog' }, project)
    expect(byNum.slice(0, 3).map((r) => r.entry.code)).toEqual(['M1', 'M2', 'M3'])
    expect(byNum.at(-1)!.entry.sources).toContain('ic')
    const bySize = applyCatalogFilters(entries, '', { ...DEFAULT_FILTERS, sort: 'size' }, project)
    expect(bySize[0].entry.object.sizeMajorArcmin!).toBeGreaterThan(200)
    const q = applyCatalogFilters(entries, 'M42', { ...DEFAULT_FILTERS, sort: 'magnitude' }, project)
    expect(q[0].entry.object.id).toBe('M42')
    // Le nom propre l'emporte sur la constellation, quel que soit le tri secondaire.
    for (const sort of ['altitude', 'magnitude', 'catalog', 'size'] as const) {
      expect(applyCatalogFilters(entries, 'andromede', { ...DEFAULT_FILTERS, sort }, project)[0].entry.object.id).toBe('M31')
    }
  })

  it('bascule de puces', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('persistance des filtres', () => {
  beforeEach(() => setCacheStorage(createMemoryStorage()))

  it('valide les valeurs stockées', () => {
    expect(sanitizeFilters(null)).toEqual(DEFAULT_FILTERS)
    expect(sanitizeFilters({ groups: ['galaxy', 'bogus'], sources: 'ngc', magLimit: 40, observableNow: 'yes', sort: 'random' })).toEqual({
      groups: ['galaxy'], sources: [], magLimit: 12, observableNow: false, sort: 'altitude',
    })
  })

  it('relit les filtres enregistrés hors-ligne', async () => {
    expect(await loadCatalogFilters()).toEqual(DEFAULT_FILTERS)
    const f = { ...DEFAULT_FILTERS, groups: ['open-cluster' as const], magLimit: 7.5, observableNow: true }
    await saveCatalogFilters(f)
    expect(await loadCatalogFilters()).toEqual(f)
  })
})
