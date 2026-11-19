/**
 * Photo AR annotée : fusion, sur un canevas hors écran à la résolution native du
 * planétarium, de l'image courante de la vidéo (recadrage object-cover identique
 * à l'écran, renfort / vision nocturne appliqués aux pixels) et du rendu
 * astronomique (constellations, noms, réticule). Partage natif si disponible,
 * sinon URL d'aperçu (appui long → Enregistrer l'image sur iOS).
 */
import { coverRect, transformPixels } from '../../services/sky/arImage'

export function composeArSnapshot(video: HTMLVideoElement, sky: HTMLCanvasElement, opts: { boost: boolean; redNight: boolean }): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sky.width
  out.height = sky.height
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, out.width, out.height)
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const r = coverRect(video.videoWidth, video.videoHeight, out.width, out.height)
    ctx.drawImage(video, r.x, r.y, r.w, r.h)
    if (opts.boost || opts.redNight) {
      const img = ctx.getImageData(0, 0, out.width, out.height)
      transformPixels(img.data, opts)
      ctx.putImageData(img, 0, 0)
    }
  }
  ctx.drawImage(sky, 0, 0)
  return out
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))

export function snapshotFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `AstroSky-AR-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.png`
}

/**
 * Partage la photo (feuille de partage iOS : Enregistrer l'image, AirDrop…).
 * Renvoie `null` si le partage a eu lieu ou a été annulé, sinon une URL d'objet
 * à afficher en aperçu téléchargeable (à révoquer par l'appelant).
 */
export async function shareSnapshot(canvas: HTMLCanvasElement, name: string): Promise<string | null> {
  const blob = await toBlob(canvas)
  if (!blob) throw new Error('Encodage PNG impossible')
  const file = new File([blob], name, { type: 'image/png' })
  const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'AstroSky AR' })
      return null
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return null
    }
  }
  return URL.createObjectURL(blob)
}
