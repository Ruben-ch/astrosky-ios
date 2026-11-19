/**
 * Traitement des pixels de la photo AR (même rendu que les filtres CSS du flux
 * en direct, appliqué à la main car `CanvasRenderingContext2D.filter` est absent
 * de Safari < 18) :
 * - renfort de visibilité : `brightness(1.45) contrast(1.2)` ;
 * - vision nocturne : luminance Rec. 601 (0,299 R + 0,587 G + 0,114 B) sur le
 *   seul canal rouge, G = B = 0 (même matrice que le filtre SVG de la vidéo).
 * Géométrie du recadrage `object-cover` partagée avec le rendu à l'écran.
 */

export const AR_BOOST_BRIGHTNESS = 1.45
export const AR_BOOST_CONTRAST = 1.2
/** Filtre CSS du renfort de visibilité nocturne. */
export const AR_BOOST_CSS = `brightness(${AR_BOOST_BRIGHTNESS}) contrast(${AR_BOOST_CONTRAST})`

/** Filtre CSS de la vidéo : renfort puis conversion en rouge pur (G = B = 0, filtre SVG d'App.tsx). */
export function arVideoFilter(boost: boolean, redNight: boolean): string {
  return [boost ? AR_BOOST_CSS : '', redNight ? 'url(#astrosky-red-night-video)' : ''].filter(Boolean).join(' ') || 'none'
}

export interface PixelOptions {
  readonly boost: boolean
  readonly redNight: boolean
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** Transforme en place un tampon RGBA (ImageData.data). */
export function transformPixels(data: Uint8ClampedArray, { boost, redNight }: PixelOptions): void {
  if (!boost && !redNight) return
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2]
    if (boost) {
      // CSS : brightness multiplie, puis contrast étire autour de 50 %.
      r = clamp255((r * AR_BOOST_BRIGHTNESS - 127.5) * AR_BOOST_CONTRAST + 127.5)
      g = clamp255((g * AR_BOOST_BRIGHTNESS - 127.5) * AR_BOOST_CONTRAST + 127.5)
      b = clamp255((b * AR_BOOST_BRIGHTNESS - 127.5) * AR_BOOST_CONTRAST + 127.5)
    }
    if (redNight) {
      data[i] = 0.299 * r + 0.587 * g + 0.114 * b
      data[i + 1] = 0
      data[i + 2] = 0
    } else {
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  }
}

/** Rectangle de destination d'une source (sw × sh) recadrée en `object-cover` dans (dw × dh). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
  if (sw <= 0 || sh <= 0) return { x: 0, y: 0, w: dw, h: dh }
  const k = Math.max(dw / sw, dh / sh)
  const w = sw * k
  const h = sh * k
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h }
}
