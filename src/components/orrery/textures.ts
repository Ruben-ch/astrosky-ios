/**
 * Textures procédurales du Système Solaire 3D, peintes en Canvas 2D à partir de
 * la palette active (aucune image externe : en vision nocturne, toutes les
 * couleurs restent des rouges purs). Bandes nuageuses des géantes, calottes
 * polaires, couronne solaire, anneaux de Saturne et point d'étoile.
 */
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, RepeatWrapping, SRGBColorSpace, type Wrapping } from 'three'
import { SATURN_RING_BANDS } from '../../data/solarSystemPhysical'
import type { OrreryPalette } from '../../theme/palette'
import type { OrreryBodyId } from '../../types/orrery'

export interface Rgba {
  readonly r: number
  readonly g: number
  readonly b: number
  /** Opacité [0, 1]. */
  readonly a: number
}

/** `#RRGGBB` ou `rgb(a)(r, g, b[, a])` → composantes 0–255 + alpha. */
export function parseColor(color: string): Rgba {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] }
  throw new Error(`Couleur non reconnue : ${color}`)
}

/** Mélange linéaire de deux couleurs en espace sRGB (rouge pur + rouge pur = rouge pur). */
export function mix(a: string, b: string, t: number, alpha = 1): string {
  const ca = parseColor(a)
  const cb = parseColor(b)
  const l = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgba(${l(ca.r, cb.r)}, ${l(ca.g, cb.g)}, ${l(ca.b, cb.b)}, ${alpha})`
}

/** Variante opaque à alpha donné d'une couleur de palette. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color)
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('Canvas 2D indisponible')
  return [c, g]
}

function texture(c: HTMLCanvasElement, wrapS: Wrapping = ClampToEdgeWrapping): CanvasTexture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = wrapS
  t.minFilter = LinearFilter
  t.generateMipmaps = false
  return t
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes bandes à chaque rendu. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BANDED: ReadonlySet<OrreryBodyId> = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune'])
const POLAR_CAPS: Readonly<Partial<Record<OrreryBodyId, number>>> = { Earth: 0.1, Mars: 0.07 }

/**
 * Texture équirectangulaire d'un globe : bandes zonales pour les géantes,
 * marbrures douces pour les planètes telluriques et lunes, calottes polaires
 * pour la Terre et Mars. Couleurs : `palette.surfaces[id]`.
 */
export function makeSurfaceTexture(id: OrreryBodyId, p: OrreryPalette): CanvasTexture {
  const [w, h] = [256, 128]
  const [c, g] = canvas(w, h)
  const [primary, secondary] = p.surfaces[id] ?? ['#808080', '#606060']
  const rand = rng(id.length * 7919 + id.charCodeAt(0) * 104729)
  g.fillStyle = primary
  g.fillRect(0, 0, w, h)
  if (BANDED.has(id)) {
    const contrast = id === 'Jupiter' ? 0.85 : id === 'Saturn' ? 0.5 : 0.25
    let y = 0
    while (y < h) {
      const band = 3 + rand() * (id === 'Jupiter' ? 10 : 16)
      g.fillStyle = mix(primary, secondary, rand() * contrast)
      g.fillRect(0, y, w, band + 1)
      y += band
    }
  } else {
    for (let i = 0; i < 90; i++) {
      const r = 4 + rand() * 18
      g.fillStyle = mix(primary, secondary, 0.4 + rand() * 0.6, 0.22)
      g.beginPath()
      g.ellipse(rand() * w, h * 0.12 + rand() * h * 0.76, r * 1.6, r, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  const cap = POLAR_CAPS[id]
  if (cap) {
    const ch = h * cap
    for (const [y0, y1] of [[0, ch], [h, h - ch]] as const) {
      const grad = g.createLinearGradient(0, y0, 0, y1)
      grad.addColorStop(0, withAlpha(p.polarCap, 0.95))
      grad.addColorStop(1, withAlpha(p.polarCap, 0))
      g.fillStyle = grad
      g.fillRect(0, Math.min(y0, y1), w, ch)
    }
  }
  return texture(c, RepeatWrapping)
}

/** Halo radial (couronne solaire) : cœur `inner` décroissant vers la transparence, avec jets coronaux. */
export function makeCoronaTexture(inner: string, outer: string, streamers: boolean): CanvasTexture {
  const s = 256
  const [c, g] = canvas(s, s)
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.32, inner)
  grad.addColorStop(0.55, outer)
  grad.addColorStop(1, withAlpha(outer, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  if (streamers) {
    const rand = rng(1919)
    g.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rand() * 0.2
      const len = s * (0.3 + rand() * 0.2)
      const lg = g.createLinearGradient(s / 2, s / 2, s / 2 + Math.cos(a) * len, s / 2 + Math.sin(a) * len)
      lg.addColorStop(0, withAlpha(outer, 0.5))
      lg.addColorStop(1, withAlpha(outer, 0))
      g.strokeStyle = lg
      g.lineWidth = 2 + rand() * 5
      g.beginPath()
      g.moveTo(s / 2, s / 2)
      g.lineTo(s / 2 + Math.cos(a) * len, s / 2 + Math.sin(a) * len)
      g.stroke()
    }
  }
  return texture(c)
}

/**
 * Profil radial des anneaux de Saturne (u = 0 au bord intérieur de l'anneau C,
 * u = 1 au bord extérieur de l'anneau A), opacités des bandes NSSDCA.
 */
export function makeRingTexture(color: string): CanvasTexture {
  const w = 512
  const [c, g] = canvas(w, 4)
  const inner = SATURN_RING_BANDS[0].innerKm
  const outer = SATURN_RING_BANDS[SATURN_RING_BANDS.length - 1].outerKm
  const rand = rng(2004)
  for (let x = 0; x < w; x++) {
    const km = inner + ((x + 0.5) / w) * (outer - inner)
    const band = SATURN_RING_BANDS.find((b) => km >= b.innerKm && km < b.outerKm) ?? SATURN_RING_BANDS[SATURN_RING_BANDS.length - 1]
    // Fines annelures : modulation déterministe de ±15 % de l'opacité de la bande.
    const alpha = Math.min(1, Math.max(0, band.opacity * (0.85 + rand() * 0.3)))
    g.fillStyle = withAlpha(color, alpha)
    g.fillRect(x, 0, 1, 4)
  }
  return texture(c)
}

/** Disque doux pour les étoiles de fond (points ronds). */
export function makeDotTexture(): CanvasTexture {
  const s = 32
  const [c, g] = canvas(s, s)
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.85)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  return texture(c)
}
