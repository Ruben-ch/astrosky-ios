/// <reference types="node" />
/**
 * APOD : sources de secours (flux RSS officiel, page d'archive), résolution des
 * médias (URL relatives, vignettes YouTube, rendus redimensionnés), chaîne de
 * repli quand l'API renvoie la réponse générique « NASA Science », purge du
 * cache corrompu. Fixtures : extraits non modifiés des pages réelles de la NASA.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_LAUNCHES_RAW } from '../../data/launchesFallback.generated'
import { cacheGet, cacheSet, setCacheStorage } from '../cache'
import { APOD_ARCHIVE_TTL_MS, isCorruptApodEntry, loadApod, nasaToday } from '../space/apod'
import {
  APOD_FEED_URL, apodArchiveUrl, apodTitleFromHtml, dateFromApodSlug, extractApodMedia, parseApodArchiveHtml, parseApodFeed,
  resolveApodUrl, sizedAssetUrl, stripHtml, youtubeId, youtubeThumbnail,
} from '../space/apodSources'
import { humanizeTbd, parseLaunch } from '../space/launchLibrary'
import { createMemoryStorage } from './memoryStorage'

const fixture = (f: string) => readFileSync(join(process.cwd(), 'src/services/__tests__/fixtures', f), 'utf8')
const FEED = fixture('apod-feed.xml')
const NOW = Date.parse('2026-11-19T15:00:00Z')
/** Réponse réelle de api.nasa.gov depuis la migration du site (relevée le 2026-11-19). */
const GENERIC = (date: string) => ({
  date, title: 'NASA Science', media_type: 'image', service_version: 'v1',
  explanation: 'Discover the cosmos! Each day a different image or photograph of our fascinating universe is featured, along with a brief explanation written by a professional astronomer.',
  url: 'https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png',
  hdurl: 'https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png',
})
const response = (body: string | object, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }) as Response

beforeEach(() => setCacheStorage(createMemoryStorage()))

describe('APOD : analyse des sources', () => {
  it('résout les liens relatifs des pages classiques et rejette les schémas non sûrs', () => {
    expect(resolveApodUrl('image/2611/Horsehead_Killion_1024.jpg')).toBe('https://apod.nasa.gov/apod/image/2611/Horsehead_Killion_1024.jpg')
    expect(resolveApodUrl('//www.youtube.com/embed/abcdefghijk')).toBe('https://www.youtube.com/embed/abcdefghijk')
    expect(resolveApodUrl('http://apod.nasa.gov/apod/image/x.jpg')).toBe('https://apod.nasa.gov/apod/image/x.jpg')
    expect(resolveApodUrl('javascript:alert(1)')).toBeNull()
    expect(resolveApodUrl('about:blank')).toBeNull()
    expect(apodArchiveUrl('2025-11-10')).toBe('https://apod.nasa.gov/apod/ap251110.html')
    expect(dateFromApodSlug('https://science.nasa.gov/image-article/apod-2026-november-8-major-fireball-meteor/')).toBe('2026-11-08')
    expect(stripHtml('in <a href="x">Illinois</a>. <br>Fin &amp; suite')).toBe('in Illinois. Fin & suite')
  })

  it('vidéos : miniature YouTube haute résolution, vidéo native', () => {
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/bVNV2-wma5E')).toBe('bVNV2-wma5E')
    expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    const yt = extractApodMedia('<center><iframe width="960" height="540" src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0" frameborder="0"></iframe></center>')
    expect(yt).toEqual({ mediaType: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', hdUrl: null, thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })
    const img = extractApodMedia('<a href="image/2611/M31_big.jpg"><IMG SRC="image/2611/M31_1024.jpg" alt="M31"></a>')
    expect(img).toMatchObject({ mediaType: 'image', url: 'https://apod.nasa.gov/apod/image/2611/M31_1024.jpg', hdUrl: 'https://apod.nasa.gov/apod/image/2611/M31_big.jpg' })
    expect(sizedAssetUrl('https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/november/x.jpg/jcr:content/renditions/cq5dam.thumbnail.48.48.png', 1280))
      .toBe('https://assets.science.nasa.gov/dynamicimage/assets/science/cds/apod/apod/2026/november/x.jpg?w=1280&fit=clip')
  })

  it('flux RSS officiel : vrais titres, images, vidéo native avec affiche', () => {
    const entries = parseApodFeed(FEED, nasaToday)
    expect(entries.map((e) => e.date)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17', '2026-11-08', '2026-10-28'])
    const today = entries[0]
    expect(today).toMatchObject({ title: 'The Horsehead and Flame Nebulas', mediaType: 'image', copyright: 'Mark E. Killion', placeholderMedia: false })
    expect(today.url).toMatch(/^https:\/\/assets\.science\.nasa\.gov\/dynamicimage\/.*Horsehead_Nebula_Killion\.jpg\?w=1280/)
    expect(today.explanation).toMatch(/^Today's image could have been a painting/)
    expect(today.explanation).not.toMatch(/Explanation:|Tomorrow's picture|\s[,.!?]/)
    // Le flux publie une vignette de 48 px en « hdurl » : l'image réelle vient de la page embarquée.
    expect(entries[3].url).toMatch(/meteor2017_Taylor_1200\.jpg\?w=1280/)
    expect(entries[4]).toMatchObject({ mediaType: 'video', url: expect.stringMatching(/occultation\.mp4$/), thumbnailUrl: expect.stringMatching(/occultation\.jpeg\?w=1280/) })
    for (const e of entries) expect(e.title).not.toBe('NASA Science')
  })

  it('page d’archive science.nasa.gov : titre réel, explication et image', () => {
    const html = fixture('apod-archive-2025-11-10.html')
    expect(apodTitleFromHtml('<title>NASA Science</title>')).toBeNull()
    const e = parseApodArchiveHtml(html, '2025-11-10')!
    expect(e).toMatchObject({ date: '2025-11-10', title: 'Micro Moon vs Super Moon', mediaType: 'image' })
    expect(e.url).toMatch(/SuperMicroMoon_Sanli_3456\.jpg\?w=1280/)
    expect(e.explanation).toMatch(/^What was so super about Wednesday's supermoon\?/)
  })
})

describe('APOD : chaîne de repli', () => {
  it('API générique « NASA Science » → entrée réelle du flux RSS', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => (String(url).startsWith(APOD_FEED_URL) ? response(FEED) : response(GENERIC('2026-11-17'))))
    const r = await loadApod('2026-11-17', { fetchImpl, nowMs: NOW })
    expect(r.entry.title).not.toBe('NASA Science')
    expect(r.entry.url).toMatch(/^https:\/\/assets\.science\.nasa\.gov\//)
    expect(r.entry.placeholderMedia).toBe(false)
    expect(fetchImpl).toHaveBeenCalledWith(APOD_FEED_URL, expect.anything())
  })

  it('aucun média hors du flux (web) : avis « média indisponible », jamais caché comme valide', async () => {
    const real = { ...GENERIC('2026-09-01'), explanation: 'A real explanation of the picture.' }
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => (String(url).startsWith(APOD_FEED_URL) ? response(FEED) : response(real)))
    const r = await loadApod('2026-09-01', { fetchImpl, nowMs: NOW })
    expect(r.entry).toMatchObject({ placeholderMedia: true, url: null, explanation: 'A real explanation of the picture.' })
    expect(r.entry.title).not.toBe('NASA Science')
  })

  it('purge au chargement le cache corrompu par l’ancienne API', async () => {
    const corrupt = { date: '2026-11-17', title: 'NASA Science', explanation: 'x', mediaType: 'image', url: null, hdUrl: null, thumbnailUrl: null, copyright: null, placeholderMedia: true }
    await cacheSet('apod:2026-11-17', corrupt, APOD_ARCHIVE_TTL_MS, NOW)
    expect(isCorruptApodEntry(corrupt as never)).toBe(true)
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => (String(url).startsWith(APOD_FEED_URL) ? response(FEED) : response(GENERIC('2026-11-17'))))
    const r = await loadApod('2026-11-17', { fetchImpl, nowMs: NOW })
    expect(r.origin).toBe('network')
    expect(r.entry.title).not.toBe('NASA Science')
    expect(((await cacheGet('apod:2026-11-17', NOW)) as { title: string }).title).toBe(r.entry.title)
  })
})

describe('Launch Library 2 : mentions « TBD »', () => {
  it('remplace TBD / TBD? par « À confirmer »', () => {
    expect(humanizeTbd('SatNet LEO Group TBD?')).toBe('SatNet LEO Group · À confirmer')
    expect(humanizeTbd('TBD')).toBe('À confirmer')
    expect(humanizeTbd('Falcon 9 Block 5')).toBe('Falcon 9 Block 5')
    const raw = BUNDLED_LAUNCHES_RAW.find((l) => /TBD\?/.test(String(l.name)))!
    const l = parseLaunch(raw)!
    expect(`${l.name} ${l.missionName} ${l.rocket} ${l.pad}`).not.toMatch(/\bTBD\b/)
  })
})
