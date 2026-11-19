/**
 * Sources de secours de l'APOD, pour contourner l'API api.nasa.gov devenue
 * inexploitable depuis la migration du site vers science.nasa.gov (elle renvoie
 * le titre « NASA Science », le logo NASA et parfois une explication générique) :
 *   - flux RSS officiel `science.nasa.gov/feed/apod-basic/` (30 derniers jours,
 *     CORS ouvert) : titre, crédit, explication et page APOD classique embarquée ;
 *   - page d'archive HTML (classique apod.nasa.gov ou image-article science.nasa.gov),
 *     lue sur iOS natif (pas de CORS) pour les dates plus anciennes.
 * Analyse par expressions régulières : aucune dépendance au DOM (tests, workers).
 */
import type { ApodEntry, ApodMediaType } from '../../types/space'

export const APOD_FEED_URL = 'https://science.nasa.gov/feed/apod-basic/'
/** Base de résolution des liens relatifs des pages APOD classiques (`image/2611/x.jpg`). */
export const APOD_CLASSIC_BASE = 'https://apod.nasa.gov/apod/'
export const APOD_SITE_URL = 'https://science.nasa.gov/apod/'
/** Largeur (px) demandée au redimensionneur d'images NASA : affichage et visionneuse HD. */
const DISPLAY_W = 1280
const HD_W = 3000

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Page d'archive APOD classique d'une date : `apYYMMDD.html` (redirigée par la NASA). */
export function apodArchiveUrl(date: string): string {
  return `${APOD_CLASSIC_BASE}ap${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}.html`
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

/** Texte brut d'un fragment HTML (balises retirées, entités décodées, espaces normalisés). */
export function stripHtml(html: string): string {
  // Balises de mise en forme retirées sans espace (« <a>Illinois</a>. » → « Illinois. »).
  const inline = /<\/?(?:a|span|em|i|b|strong|u|sup|sub|font|abbr|cite|code)\b[^>]*>/gi
  return decodeEntities(html.replace(inline, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Explication APOD nettoyée : sans le préfixe « Explanation: » ni le teaser « Tomorrow's picture ». */
export function cleanExplanation(html: string): string {
  return stripHtml(html)
    .replace(/^Explanation:\s*/i, '')
    .replace(/\s*Tomorrow['’]s picture:.*$/i, '')
    .trim()
}

/** Résout un lien (relatif `image/…`, protocole implicite `//…`, `http:`) en URL https absolue. */
export function resolveApodUrl(href: string | undefined | null, base: string = APOD_CLASSIC_BASE): string | null {
  const raw = href ? decodeEntities(href.trim()) : ''
  if (!raw || /^(about:|javascript:|data:|#)/i.test(raw)) return null
  try {
    const u = new URL(raw, base)
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** Identifiant YouTube d'une URL d'intégration ou de lecture, sinon `null`. */
export function youtubeId(url: string): string | null {
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(url)
  return m ? m[1] : null
}

/** Miniature haute résolution d'une vidéo YouTube. */
export const youtubeThumbnail = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`

/** Rendu redimensionné d'une image du gestionnaire d'actifs NASA (sinon URL inchangée). */
export function sizedAssetUrl(url: string, widthPx: number): string {
  const rendition = /^(https:\/\/assets\.science\.nasa\.gov)\/content\/dam\/(.+?\.(?:jpe?g|png|gif|webp))(?:\/jcr:content\/renditions\/.+)?$/i.exec(url)
  const base = rendition ? `${rendition[1]}/dynamicimage/assets/${rendition[2]}` : url
  if (!/^https:\/\/assets\.science\.nasa\.gov\/dynamicimage\//i.test(base)) return base
  return `${base.split('?')[0]}?w=${widthPx}&fit=clip`
}

/** Vignette CQ5 minuscule (48 px) que le flux publie parfois en guise de « hdurl ». */
const isTinyRendition = (url: string) => /\/jcr:content\/renditions\/cq5dam\.thumbnail\./i.test(url)
const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined)

export interface ApodMedia {
  readonly mediaType: ApodMediaType
  readonly url: string | null
  readonly hdUrl: string | null
  readonly thumbnailUrl: string | null
}

const NO_MEDIA: ApodMedia = { mediaType: 'other', url: null, hdUrl: null, thumbnailUrl: null }

/** Est-ce une image APOD (et non un logo, une icône ou un pixel de suivi du site) ? */
const isApodImage = (url: string) => /\/apod\/|\/cds\/apod\/|^https:\/\/apod\.nasa\.gov\/apod\/image\//i.test(url) && !/logo|icon|sprite|favicon/i.test(url)

/**
 * Média principal d'une page APOD (classique ou science.nasa.gov) :
 * vidéo intégrée (YouTube → miniature HD), vidéo native, puis image (lien HD englobant).
 */
export function extractApodMedia(html: string, base: string = APOD_CLASSIC_BASE): ApodMedia {
  for (const m of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const src = resolveApodUrl(attr(m[0], 'src'), base)
    if (!src || !/youtube|youtu\.be|vimeo/i.test(src)) continue
    const yt = youtubeId(src)
    return { mediaType: 'video', url: yt ? `https://www.youtube.com/embed/${yt}` : src, hdUrl: null, thumbnailUrl: yt ? youtubeThumbnail(yt) : null }
  }
  const video = /<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/?>/i.exec(html)?.[0]
  if (video) {
    const src = resolveApodUrl(attr(video, 'src') ?? attr(/<source\b[^>]*>/i.exec(video)?.[0] ?? '', 'src'), base)
    if (src) return { mediaType: 'video', url: src, hdUrl: null, thumbnailUrl: resolveApodUrl(attr(video, 'poster'), base) }
  }
  for (const m of html.matchAll(/(<a\b[^>]*>\s*)?<img\b[^>]*>/gi)) {
    const src = resolveApodUrl(attr(m[0].slice(m[1]?.length ?? 0), 'src'), base)
    if (!src || !isApodImage(src)) continue
    const href = m[1] ? resolveApodUrl(attr(m[1], 'href'), base) : null
    const hd = href && /\.(jpe?g|png|gif|webp|tiff?)(\?|$)/i.test(href) ? href : src
    return { mediaType: 'image', url: sizedAssetUrl(src, DISPLAY_W), hdUrl: sizedAssetUrl(hd, HD_W), thumbnailUrl: null }
  }
  const og = /<meta\s+property="og:image"\s+content="([^"]+)"/i.exec(html)?.[1]
  const ogUrl = resolveApodUrl(og, base)
  if (ogUrl && isApodImage(ogUrl) && !isTinyRendition(ogUrl)) return { mediaType: 'image', url: sizedAssetUrl(ogUrl, DISPLAY_W), hdUrl: sizedAssetUrl(ogUrl, HD_W), thumbnailUrl: null }
  return NO_MEDIA
}

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
  return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1') : null
}

/** Date APOD d'un lien `…/apod-2026-november-19-titre/`, sinon `null`. */
export function dateFromApodSlug(link: string): string | null {
  const m = /apod-(\d{4})-([a-z]+)-(\d{1,2})(?:-|\/|$)/i.exec(link)
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  return m && month >= 0 ? `${m[1]}-${String(month + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}` : null
}

/** Entrées APOD du flux RSS officiel (les plus récentes d'abord). Entrées incomplètes ignorées. */
export function parseApodFeed(xml: string, toNasaDate: (ms: number) => string): ApodEntry[] {
  const out: ApodEntry[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = m[1]
    const link = stripHtml(tag(item, 'link') ?? '')
    const pub = Date.parse(stripHtml(tag(item, 'pubDate') ?? ''))
    const date = dateFromApodSlug(link) ?? (Number.isFinite(pub) ? toNasaDate(pub) : null)
    const title = stripHtml(tag(item, 'title') ?? '')
    const explanation = cleanExplanation(tag(item, 'apod:explanation') ?? tag(item, 'description') ?? '')
    if (!date || !title || /^NASA Science$/i.test(title) || !explanation) continue
    let media = extractApodMedia(tag(item, 'content:encoded') ?? '')
    const hd = resolveApodUrl(stripHtml(tag(item, 'apod:hdurl') ?? ''))
    if (hd && !isTinyRendition(hd)) {
      if (media.mediaType === 'other') media = { mediaType: 'image', url: sizedAssetUrl(hd, DISPLAY_W), hdUrl: sizedAssetUrl(hd, HD_W), thumbnailUrl: null }
      // Vidéo native sans affiche : l'image fixe publiée sert de vignette.
      else if (media.mediaType === 'video' && !media.thumbnailUrl) media = { ...media, thumbnailUrl: sizedAssetUrl(hd, DISPLAY_W) }
    }
    out.push({ date, title, explanation, ...media, copyright: stripHtml(tag(item, 'apod:copyright') ?? '') || null, placeholderMedia: false })
  }
  return out
}

/** Vrai titre d'une page APOD (jamais le générique « NASA Science »), sinon `null`. */
export function apodTitleFromHtml(html: string): string | null {
  const fromTitle = /<title>\s*APOD:\s*\d{4}\s+\w+\s+\d{1,2}\s*-\s*([\s\S]+?)\s*(?:-\s*NASA Science\s*)?<\/title>/i.exec(html)?.[1]
  const fromH1 = /<h1\b[^>]*class="[^"]*display-48[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  const fromClassic = /<center>\s*<b>([\s\S]*?)<\/b>/i.exec(html)?.[1]
  for (const raw of [fromTitle, fromH1, fromClassic]) {
    const t = raw ? stripHtml(raw) : ''
    if (t && !/^(NASA Science|APOD|Astronomy Picture of the Day)$/i.test(t)) return t
  }
  return null
}

/** Entrée APOD extraite d'une page d'archive HTML ; `null` si le titre ou l'explication manquent. */
export function parseApodArchiveHtml(html: string, date: string): ApodEntry | null {
  const title = apodTitleFromHtml(html)
  const expl = /Explanation:\s*(?:<\/(?:strong|b)>)?([\s\S]*?)(?:<\/p>|Tomorrow['’]s picture)/i.exec(html)?.[1]
  const explanation = expl ? cleanExplanation(expl) : ''
  if (!title || !explanation) return null
  const credit = /(?:Image\s+)?Credit[\s\S]{0,80}?:\s*<\/b>([\s\S]*?)<\/center>/i.exec(html)?.[1]
  return { date, title, explanation, ...extractApodMedia(html), copyright: credit ? stripHtml(credit) || null : null, placeholderMedia: false }
}

/** Réponse générique de l'API (logo, titre du site ou explication de la page d'accueil). */
export function isGenericApodText(title: string | undefined, explanation: string | undefined): boolean {
  return /^NASA Science$/i.test(title?.trim() ?? '') || /^Discover the cosmos!/i.test(explanation?.trim() ?? '')
}
