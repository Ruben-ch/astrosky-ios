import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_APOD_RAW } from '../../data/apodFallback.generated'
import { BUNDLED_LAUNCHES_RAW } from '../../data/launchesFallback.generated'
import { cacheGet, cacheSet, setCacheStorage } from '../cache'
import {
  APOD_FIRST_DATE,
  APOD_TODAY_TTL_MS,
  clampApodDate,
  isEmbeddedVideo,
  isPlaceholderMedia,
  loadApod,
  nasaToday,
  parseApod,
  shiftApodDate,
} from '../space/apod'
import { countdownTo, formatCountdown, formatCountdownShort } from '../space/countdown'
import { LAUNCHES_TTL_MS, LaunchParseError, bundledLaunches, launchStatusOf, loadLaunches, parseLaunch, parseLaunchResponse, upcomingLaunches } from '../space/launchLibrary'
import { createMemoryStorage } from './memoryStorage'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
const NOW = Date.parse('2026-11-18T21:00:00Z')

beforeEach(() => setCacheStorage(createMemoryStorage()))

describe('Launch Library 2 : analyse', () => {
  it('normalise un lancement réel embarqué', () => {
    const all = bundledLaunches()
    expect(all.length).toBe(BUNDLED_LAUNCHES_RAW.length)
    const f9 = all.find((l) => l.provider === 'SpaceX')!
    expect(f9.rocket).toMatch(/Falcon 9/)
    expect(f9.status).toBe('go')
    expect(f9.statusLabel).toBe('Go')
    expect(f9.pad.length).toBeGreaterThan(3)
    expect(f9.net).toBeInstanceOf(Date)
    for (let i = 1; i < all.length; i++) expect(all[i].net.getTime()).toBeGreaterThanOrEqual(all[i - 1].net.getTime())
    expect(new Set(all.map((l) => l.status))).toEqual(new Set(['go', 'tbc', 'tbd']))
    expect(all.some((l) => l.netPrecision === 'Month')).toBe(true)
  })

  it('tolère les champs manquants et écarte les entrées inexploitables', () => {
    expect(parseLaunch({ id: 'x', name: 'Electron | Test' , net: 'pas une date' })).toBeNull()
    expect(parseLaunch({ name: 'Sans id', net: '2026-12-01T00:00:00Z' })).toBeNull()
    const l = parseLaunch({ id: 'a', name: 'Electron | Mission X', net: '2026-12-01T00:00:00Z', pad: { latitude: '-39.26', longitude: 177.86 } })!
    expect(l).toMatchObject({ missionName: 'Mission X', rocket: 'Electron', provider: 'Opérateur inconnu', status: 'unknown', padLatitudeDeg: -39.26, padLongitudeDeg: 177.86, webcastLive: false })
    const vague = parseLaunch({ id: 'b', name: 'X | Y', net: '2026-12-01T00:00:00Z', mission: { description: 'Details TBD.', type: 'Unknown', orbit: { name: 'Unknown' } } })!
    expect(vague).toMatchObject({ missionDescription: null, missionType: null, orbit: null })
    expect(launchStatusOf('Hold')).toBe('hold')
    expect(launchStatusOf('In Flight')).toBe('in-flight')
    expect(launchStatusOf('Partial Failure')).toBe('partial-failure')
    expect(() => parseLaunchResponse({ detail: 'Request was throttled.' })).toThrow(LaunchParseError)
  })

  it('filtre les lancements à venir à l’instant simulé (T+ 1 h tolérée)', () => {
    const all = bundledLaunches()
    const up = upcomingLaunches(all, NOW)
    expect(up.every((l) => l.net.getTime() >= NOW - 3_600_000)).toBe(true)
    expect(upcomingLaunches(all, Date.parse('2040-01-01'))).toEqual([])
  })
})

describe('Launch Library 2 : cache et secours', () => {
  const raw = { results: BUNDLED_LAUNCHES_RAW.slice(0, 3) }

  it('réseau puis cache 6 h (dates restaurées), puis périmé si l’API tombe', async () => {
    const fetchImpl = vi.fn(async () => json(raw))
    const a = await loadLaunches({ fetchImpl, nowMs: NOW })
    expect(a.origin).toBe('network')
    expect(a.launches).toHaveLength(3)
    const b = await loadLaunches({ fetchImpl, nowMs: NOW + LAUNCHES_TTL_MS - 1000 })
    expect(b.origin).toBe('cache')
    expect(b.launches[0].net).toBeInstanceOf(Date)
    expect(b.launches[0].net.getTime()).toBe(a.launches[0].net.getTime())
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const down = vi.fn(async () => json({ detail: 'throttled' }, 429))
    const c = await loadLaunches({ fetchImpl: down, nowMs: NOW + LAUNCHES_TTL_MS + 1000 })
    expect(c.origin).toBe('stale-cache')
    expect(c.launches).toHaveLength(3)
  })

  it('données embarquées si l’API n’a jamais répondu', async () => {
    const res = await loadLaunches({ fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch') }), nowMs: NOW })
    expect(res.origin).toBe('bundled')
    expect(res.launches.length).toBe(BUNDLED_LAUNCHES_RAW.length)
  })
})

describe('compte à rebours', () => {
  it('T− et T+ avec jours, heures, minutes, secondes', () => {
    const c = countdownTo(NOW + (2 * 86_400 + 4 * 3600 + 12 * 60 + 9) * 1000 + 400, NOW)
    expect(c).toMatchObject({ sign: -1, days: 2, hours: 4, minutes: 12, seconds: 9 })
    expect(formatCountdown(c)).toBe('T− 2 j 04:12:09')
    expect(formatCountdownShort(c)).toBe('dans 2 j 4 h')
    const after = countdownTo(NOW - 195_000, NOW)
    expect(formatCountdown(after)).toBe('T+ 00:03:15')
    expect(formatCountdownShort(after)).toBe('il y a 3 min 15 s')
  })
})

describe('APOD : dates et analyse', () => {
  it('jour NASA (US/Eastern), bornes et décalages', () => {
    expect(nasaToday(Date.parse('2026-11-18T03:00:00Z'))).toBe('2026-11-17') // 22 h à New York
    expect(nasaToday(Date.parse('2026-11-18T06:00:00Z'))).toBe('2026-11-18')
    expect(clampApodDate('2030-01-01', NOW)).toBe('2026-11-18')
    expect(clampApodDate('1990-01-01', NOW)).toBe(APOD_FIRST_DATE)
    expect(clampApodDate('n’importe quoi', NOW)).toBe('2026-11-18')
    expect(shiftApodDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftApodDate('2024-12-31', 1)).toBe('2025-01-01')
  })

  it('analyse l’APOD embarquée (page officielle) et détecte les réponses génériques', () => {
    const e = parseApod(BUNDLED_APOD_RAW)
    expect(e).toMatchObject({ date: '2026-11-18', title: 'A Medium-Sized Solar Flare', mediaType: 'image', copyright: 'Mario Cogo', placeholderMedia: false })
    expect(e.hdUrl).toMatch(/^https:\/\/assets\.science\.nasa\.gov\/.*solar_M_flare\.jpg/)
    expect(e.explanation).not.toMatch(/\s[,.!?]/)
    const generic = { date: '2026-11-17', title: 'NASA Science', explanation: 'Discover the cosmos!', media_type: 'image', url: 'https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png' }
    expect(isPlaceholderMedia(generic)).toBe(true)
    expect(parseApod(generic)).toMatchObject({ placeholderMedia: true, url: null, hdUrl: null })
    expect(() => parseApod({ date: '2026-11-17' })).toThrow()
    const video = parseApod({ date: '2026-01-01', title: 'V', explanation: 'x', media_type: 'video', url: '//www.youtube.com/embed/abc', thumbnail_url: 'http://img.youtube.com/vi/abc/0.jpg' })
    expect(video).toMatchObject({ mediaType: 'video', url: 'https://www.youtube.com/embed/abc', thumbnailUrl: 'https://img.youtube.com/vi/abc/0.jpg' })
    expect(isEmbeddedVideo(video.url!)).toBe(true)
    expect(isEmbeddedVideo('https://apod.nasa.gov/apod/image/clip.mp4')).toBe(false)
  })
})

describe('APOD : cache hors-ligne', () => {
  const entry = (date: string) => ({ ...BUNDLED_APOD_RAW, date, title: `APOD ${date}` })

  it('met en cache par date et relit sans réseau', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => json(entry(/date=([\d-]+)/.exec(String(url))![1])))
    const a = await loadApod('2026-11-10', { fetchImpl, nowMs: NOW })
    expect(a).toMatchObject({ origin: 'network', requestedDate: '2026-11-10' })
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/api_key=.+&date=2026-11-10&thumbs=true/)
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const b = await loadApod('2026-11-10', { fetchImpl: offline, nowMs: NOW + 86_400_000 })
    expect(b.origin).toBe('cache')
    expect(b.entry.title).toBe('APOD 2026-11-10')
    expect(await cacheGet('apod:2026-11-10', NOW)).not.toBeNull()
  })

  it('jour même non publié : repli sur la veille', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const d = /date=([\d-]+)/.exec(String(url))![1]
      return d === '2026-11-18' ? json({ code: 404, msg: 'No data available for date' }, 404) : json(entry(d))
    })
    const r = await loadApod('2026-11-18', { fetchImpl, nowMs: NOW })
    expect(r.requestedDate).toBe('2026-11-18')
    expect(r.entry.date).toBe('2026-11-17')
  })

  it('entrée du jour périmée après 6 h, relue en secours si l’API est hors service', async () => {
    await cacheSet('apod:2026-11-18', parseApod(entry('2026-11-18')), APOD_TODAY_TTL_MS, NOW - APOD_TODAY_TTL_MS - 1000)
    const down = vi.fn(async () => json({ code: 500 }, 500))
    const r = await loadApod('2026-11-18', { fetchImpl: down, nowMs: NOW })
    expect(r.origin).toBe('stale-cache')
    expect(r.entry.title).toBe('APOD 2026-11-18')
  })

  it('hors-ligne sans cache : image embarquée pour le jour, erreur pour une archive', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const today = await loadApod('2026-11-18', { fetchImpl: offline, nowMs: NOW })
    expect(today.origin).toBe('bundled')
    expect(today.entry.title).toBe('A Medium-Sized Solar Flare')
    await expect(loadApod('2026-10-01', { fetchImpl: offline, nowMs: NOW })).rejects.toThrow(/indisponible/)
  })
})
