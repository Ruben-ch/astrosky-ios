/**
 * Image Astronomique du Jour (NASA APOD) : dates au fuseau de la NASA (US/Eastern),
 * analyse défensive, cache hors-ligne par date et image embarquée en dernier secours.
 * Chaîne de sources : api.nasa.gov → (réponse générique « NASA Science ») flux RSS
 * officiel science.nasa.gov (30 jours) → page d'archive HTML (iOS natif uniquement,
 * le site n'ayant pas d'en-têtes CORS) → texte seul avec bandeau « média indisponible ».
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { BUNDLED_APOD_RAW } from '../../data/apodFallback.generated'
import type { ApodApiRaw, ApodEntry, ApodMediaType, ApodResult } from '../../types/space'
import { cacheReadStale, cacheRemove, cachedFetch } from '../cache'
import { APOD_FEED_URL, apodArchiveUrl, isGenericApodText, parseApodArchiveHtml, parseApodFeed, youtubeId, youtubeThumbnail } from './apodSources'

export const APOD_API_URL = 'https://api.nasa.gov/planetary/apod'
/** Première APOD publiée. */
export const APOD_FIRST_DATE = '1995-06-16'
/** Entrée du jour : peut encore être publiée ou corrigée → 6 h ; archives : 30 jours. */
export const APOD_TODAY_TTL_MS = 6 * 3_600_000
export const APOD_ARCHIVE_TTL_MS = 30 * 86_400_000
const FETCH_TIMEOUT_MS = 12_000
const DAY_MS = 86_400_000

export class ApodError extends Error {}

/** Clé API NASA : `VITE_NASA_API_KEY` si fournie au build, sinon la clé de démonstration publique. */
export function apodApiKey(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  return env?.VITE_NASA_API_KEY?.trim() || 'DEMO_KEY'
}

const nasaDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Date APOD du jour (US/Eastern) à l'instant `nowMs`, `"AAAA-MM-JJ"`. */
export function nasaToday(nowMs: number = Date.now()): string {
  return nasaDateFmt.format(new Date(nowMs))
}

export const isApodDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T00:00:00Z`))

/** Décale une date APOD de `days` jours (arithmétique calendaire UTC). */
export function shiftApodDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Borne une date entre la première APOD et celle du jour. */
export function clampApodDate(date: string, nowMs: number = Date.now()): string {
  const today = nasaToday(nowMs)
  if (!isApodDate(date) || date > today) return today
  return date < APOD_FIRST_DATE ? APOD_FIRST_DATE : date
}

/** Réponse générique de l'API (logo NASA, titre du site) : le média n'est pas celui du jour. */
export function isPlaceholderMedia(raw: ApodApiRaw): boolean {
  const url = `${raw.url ?? ''} ${raw.hdurl ?? ''}`
  return /nasa-logo|\/themes\/nasa-child\//i.test(url) || isGenericApodText(raw.title, raw.explanation)
}

/** Entrée en cache corrompue par l'ancienne API (titre « NASA Science », média générique). */
export function isCorruptApodEntry(e: ApodEntry | null | undefined): boolean {
  return !e || e.placeholderMedia || isGenericApodText(e.title, e.explanation)
}

function mediaTypeOf(raw: ApodApiRaw): ApodMediaType {
  if (raw.media_type === 'image') return 'image'
  if (raw.media_type === 'video') return 'video'
  return 'other'
}

const httpsUrl = (u: string | undefined): string | null => {
  if (!u?.trim()) return null
  const s = u.trim().replace(/^http:\/\//i, 'https://')
  return s.startsWith('//') ? `https:${s}` : /^https:\/\//i.test(s) ? s : null
}

/** Normalise une réponse APOD ; lève `ApodError` si la date, le titre ou l'explication manquent. */
export function parseApod(raw: unknown): ApodEntry {
  const r = (raw ?? {}) as ApodApiRaw
  if (!r.date || !isApodDate(r.date) || !r.title?.trim() || !r.explanation?.trim()) throw new ApodError('Réponse APOD incomplète')
  const placeholder = isPlaceholderMedia(r)
  const url = placeholder ? null : httpsUrl(r.url)
  const yt = mediaTypeOf(r) === 'video' && url ? youtubeId(url) : null
  return {
    date: r.date,
    title: r.title.trim(),
    explanation: r.explanation.replace(/\s+/g, ' ').trim(),
    mediaType: mediaTypeOf(r),
    url,
    hdUrl: placeholder ? null : httpsUrl(r.hdurl),
    // Vidéo YouTube : miniature haute résolution déduite de l'identifiant.
    thumbnailUrl: placeholder ? null : yt ? youtubeThumbnail(yt) : httpsUrl(r.thumbnail_url),
    copyright: r.copyright?.replace(/\s+/g, ' ').trim() || null,
    placeholderMedia: placeholder,
  }
}

/** Vidéo intégrable par iframe (YouTube, Vimeo) plutôt que par balise <video>. */
export function isEmbeddedVideo(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url)
}

export function bundledApod(): ApodEntry {
  return parseApod(BUNDLED_APOD_RAW)
}

async function fetchWithTimeout(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) throw new ApodError(`APOD HTTP ${res.status} (${url.split('?')[0]})`)
    return res
  } finally {
    clearTimeout(timer)
  }
}

async function fetchApodJson(date: string, fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchWithTimeout(`${APOD_API_URL}?api_key=${encodeURIComponent(apodApiKey())}&date=${date}&thumbs=true`, fetchImpl)
  return res.json()
}

/** Flux RSS officiel (30 derniers jours), analysé puis mis en cache 6 h. */
async function loadFeed(fetchImpl: typeof fetch, nowMs: number): Promise<readonly ApodEntry[]> {
  const res = await cachedFetch<ApodEntry[]>('apod-feed', APOD_TODAY_TTL_MS, async () => {
    const entries = parseApodFeed(await (await fetchWithTimeout(APOD_FEED_URL, fetchImpl)).text(), nasaToday)
    if (entries.length === 0) throw new ApodError('Flux APOD vide')
    return entries
  }, { nowMs })
  return res.value
}

/** Page d'archive HTML via le pont HTTP natif (iOS) : sans CORS, impossible depuis le web. */
async function loadArchivePage(date: string): Promise<ApodEntry | null> {
  if (!Capacitor.isNativePlatform()) return null
  const res = await CapacitorHttp.get({ url: apodArchiveUrl(date), responseType: 'text', connectTimeout: FETCH_TIMEOUT_MS, readTimeout: FETCH_TIMEOUT_MS })
  return res.status === 200 && typeof res.data === 'string' ? parseApodArchiveHtml(res.data, date) : null
}

/** APOD d'une date en essayant chaque source dans l'ordre ; lève si aucune ne répond. */
async function fetchApodEntry(date: string, nowMs: number, fetchImpl: typeof fetch): Promise<ApodEntry> {
  const api = await fetchApodJson(date, fetchImpl).then(parseApod).catch(() => null)
  if (api && !isCorruptApodEntry(api)) return api
  const fromFeed = await loadFeed(fetchImpl, nowMs).then((list) => list.find((e) => e.date === date) ?? null).catch(() => null)
  if (fromFeed) return fromFeed
  const fromArchive = await loadArchivePage(date).catch(() => null)
  if (fromArchive) return fromArchive
  // Dernier recours : l'explication réelle de l'API, sans média ni titre exploitables.
  if (api && !isGenericApodText(undefined, api.explanation)) {
    return { ...api, title: isGenericApodText(api.title, undefined) ? 'Astronomy Picture of the Day' : api.title, url: null, hdUrl: null, thumbnailUrl: null, placeholderMedia: true }
  }
  throw new ApodError(`APOD du ${date} introuvable`)
}

async function loadOne(date: string, nowMs: number, fetchImpl: typeof fetch, force?: boolean) {
  const key = `apod:${date}`
  // Purge des entrées corrompues par l'ancienne API (titre « NASA Science », logo).
  const cached = await cacheReadStale<ApodEntry>(key)
  if (cached && isCorruptApodEntry(cached.value)) await cacheRemove(key)
  const ttl = date === nasaToday(nowMs) ? APOD_TODAY_TTL_MS : APOD_ARCHIVE_TTL_MS
  return cachedFetch<ApodEntry>(key, ttl, () => fetchApodEntry(date, nowMs, fetchImpl), { force, nowMs })
}

/**
 * APOD d'une date (bornée au jour NASA). Pour le jour même, si la NASA n'a pas
 * encore publié, repli sur la veille. Hors-ligne sans cache : image embarquée
 * si elle correspond, sinon `ApodError`.
 */
export async function loadApod(date: string, options: { fetchImpl?: typeof fetch; nowMs?: number; force?: boolean } = {}): Promise<ApodResult> {
  const nowMs = options.nowMs ?? Date.now()
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const requestedDate = clampApodDate(date, nowMs)
  const candidates = requestedDate === nasaToday(nowMs) ? [requestedDate, shiftApodDate(requestedDate, -1)] : [requestedDate]
  for (const d of candidates) {
    try {
      const res = await loadOne(d, nowMs, fetchImpl, options.force)
      return { entry: res.value, fetchedAt: res.storedAt, origin: res.origin, requestedDate }
    } catch {
      /* essai suivant */
    }
  }
  const stale = await cacheReadStale<ApodEntry>(`apod:${requestedDate}`)
  if (stale && !isCorruptApodEntry(stale.value)) return { entry: stale.value, fetchedAt: stale.storedAt, origin: 'stale-cache', requestedDate }
  const bundled = bundledApod()
  if (bundled.date === requestedDate || candidates.includes(bundled.date) || requestedDate === nasaToday(nowMs)) {
    return { entry: bundled, fetchedAt: Date.parse(`${bundled.date}T12:00:00Z`), origin: 'bundled', requestedDate }
  }
  throw new ApodError(`APOD du ${requestedDate} indisponible hors-ligne`)
}
