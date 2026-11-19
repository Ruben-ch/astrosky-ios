/**
 * Silhouettes proportionnées des objets du ciel profond (Canvas 2D) : l'ellipse
 * englobante respecte exactement les dimensions de catalogue et l'angle de
 * position ; le rendu intérieur (gradients, grains d'étoiles) est une
 * stylisation déterministe propre au type, sans couleur codée en dur.
 */
import type { DeepSkyType } from '../../../types/catalog'
import type { FovPalette } from '../../../theme/palette'

export interface SilhouetteSpec {
  readonly type: DeepSkyType
  /** Demi-grand axe et demi-petit axe, en pixels CSS. */
  readonly rxPx: number
  readonly ryPx: number
  /** Orientation du grand axe à l'écran, en radians (repère canvas). */
  readonly rotationRad: number
  /** Graine du rendu stylisé (stable pour un même objet). */
  readonly seed: string
  /** Contour pointillé des dimensions de catalogue. */
  readonly outline?: boolean
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) initialisé par une chaîne. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = (h << 13) | (h >>> 19)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Disque flou elliptique centré en (0, 0) dans le repère courant. */
function glow(ctx: CanvasRenderingContext2D, rx: number, ry: number, stops: readonly [number, string][]) {
  ctx.save()
  ctx.scale(1, Math.max(0.05, ry / Math.max(rx, 0.01)))
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, 0.5))
  for (const [o, c] of stops) g.addColorStop(o, c)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(rx, 0.5), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Points distribués dans l'ellipse ; `concentration` > 1 resserre vers le centre. */
function starGrains(ctx: CanvasRenderingContext2D, s: SilhouetteSpec, p: FovPalette, count: number, concentration: number, rand: () => number) {
  ctx.fillStyle = p.objectCore
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rand(), concentration)
    const a = rand() * Math.PI * 2
    const size = 0.5 + rand() * rand() * 1.6
    ctx.globalAlpha = 0.45 + rand() * 0.55
    dot(ctx, Math.cos(a) * r * s.rxPx, Math.sin(a) * r * s.ryPx, size)
  }
  ctx.globalAlpha = 1
}

/** Dessine la silhouette en (cx, cy). Sous ~2,5 px, l'objet est figuré par un point marqué. */
export function drawSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: SilhouetteSpec, p: FovPalette): void {
  const rand = seededRandom(s.seed)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(s.rotationRad)
  const { rxPx: rx, ryPx: ry } = s
  if (rx < 2.5) {
    ctx.fillStyle = p.objectCore
    dot(ctx, 0, 0, 1.6)
    ctx.restore()
    return
  }
  const halo = p.objectHalo
  const core = p.objectCore
  switch (s.type) {
    case 'galaxy':
      glow(ctx, rx, ry, [[0, core], [0.08, core], [0.3, halo], [1, 'rgba(0, 0, 0, 0)']])
      break
    case 'globular-cluster':
      glow(ctx, rx, ry, [[0, core], [0.25, halo], [1, 'rgba(0, 0, 0, 0)']])
      starGrains(ctx, s, p, Math.min(220, 30 + rx * 3), 1.8, rand)
      break
    case 'open-cluster':
    case 'asterism':
    case 'star-cloud': {
      if (s.type === 'star-cloud') glow(ctx, rx, ry, [[0, halo], [1, 'rgba(0, 0, 0, 0)']])
      const n = s.type === 'asterism' ? 6 : s.type === 'star-cloud' ? Math.min(400, 60 + rx * 4) : Math.min(120, 14 + rx * 1.2)
      starGrains(ctx, s, p, n, s.type === 'star-cloud' ? 0.9 : 0.75, rand)
      break
    }
    case 'double-star':
      ctx.fillStyle = core
      dot(ctx, -rx * 0.5, 0, 2)
      dot(ctx, rx * 0.5, 0, 1.6)
      break
    case 'planetary-nebula':
      glow(ctx, rx, ry, [[0, halo], [0.55, halo], [0.78, core], [0.92, halo], [1, 'rgba(0, 0, 0, 0)']])
      break
    case 'supernova-remnant': {
      ctx.strokeStyle = core
      ctx.lineCap = 'round'
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * Math.PI * 2 + rand() * 0.3
        const span = 0.25 + rand() * 0.4
        ctx.globalAlpha = 0.35 + rand() * 0.5
        ctx.lineWidth = Math.max(0.8, rx * (0.015 + rand() * 0.03))
        const k = 0.82 + rand() * 0.18
        ctx.beginPath()
        ctx.ellipse(0, 0, rx * k, ry * k, 0, a0, a0 + span)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'dark-nebula':
      ctx.fillStyle = p.darkNebula
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    default: {
      // Nébuleuses diffuses (émission, réflexion, amas + nébuleuse) : nuées superposées.
      for (let i = 0; i < 7; i++) {
        ctx.save()
        ctx.translate((rand() - 0.5) * rx * 0.7, (rand() - 0.5) * ry * 0.7)
        ctx.globalAlpha = 0.35 + rand() * 0.35
        glow(ctx, rx * (0.35 + rand() * 0.4), ry * (0.35 + rand() * 0.4), [[0, i === 0 ? core : halo], [1, 'rgba(0, 0, 0, 0)']])
        ctx.restore()
      }
      if (s.type === 'cluster-nebula') starGrains(ctx, s, p, Math.min(40, 8 + rx * 0.4), 1, rand)
    }
  }
  if (s.outline) {
    ctx.strokeStyle = p.objectEdge
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}
