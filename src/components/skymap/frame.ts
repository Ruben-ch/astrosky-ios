/**
 * Contexte partagé par les modules de dessin du planétarium pour une frame :
 * canevas, projecteur, couches, palette, placement d'étiquettes et cibles
 * de sélection collectées pendant le dessin.
 */
import type { PickCandidate } from '../../services/sky/skyStyle'
import { projectXYZ, type Projector } from '../../services/sky/projection'
import type { RenderPalette, ThemeName } from '../../theme/palette'
import type { SkyLayers, SkyView } from '../../types/sky'

export interface FrameContext {
  readonly ctx: CanvasRenderingContext2D
  readonly width: number
  readonly height: number
  readonly view: SkyView
  readonly proj: Projector
  readonly layers: SkyLayers
  readonly p: RenderPalette
  readonly theme: ThemeName
  /** Temps réel (s) pour la scintillation, indépendant de l'horloge simulée. */
  readonly timeSec: number
  readonly labels: LabelPlacer
  readonly candidates: PickCandidate[]
  /** Caméra AR : fond transparent sur la vidéo, libellés détourés d'une ombre sombre. */
  readonly transparent: boolean
}

/** Rectangle CSS occupé par une surcouche d'interface. */
export interface ScreenRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Zone libre du canevas (hors surcouches) où la flèche de guidage doit rester. */
export interface FreeBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

/**
 * Zone libre déduite des surcouches : commandes latérales centrées (zoom) →
 * marge droite ; autres surcouches → bandeau du haut ou du bas selon leur centre.
 * Garantit au moins 80 px autour du centre de l'écran.
 */
export function freeBounds(width: number, height: number, hud: readonly ScreenRect[]): FreeBounds {
  let top = 0
  let bottom = height
  let right = width
  for (const r of hud) {
    const side = r.w < width * 0.3 && r.x > width * 0.6 && r.y > height * 0.25 && r.y + r.h < height * 0.75
    if (side) right = Math.min(right, r.x)
    else if (r.y + r.h / 2 < height / 2) top = Math.max(top, r.y + r.h)
    else bottom = Math.min(bottom, r.y)
  }
  return {
    left: 0,
    right: Math.max(right, width / 2 + 80),
    top: Math.min(top, height / 2 - 80),
    bottom: Math.max(bottom, height / 2 + 80),
  }
}

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'

/** Placement glouton d'étiquettes : refuse toute étiquette qui en chevauche une autre. */
export class LabelPlacer {
  private readonly boxes: number[] = []

  reset(): void {
    this.boxes.length = 0
  }

  /** Réserve le rectangle s'il est libre ; renvoie `true` si l'étiquette peut être dessinée. */
  reserve(x: number, y: number, w: number, h: number): boolean {
    const b = this.boxes
    for (let i = 0; i < b.length; i += 4) {
      if (x < b[i + 2] && x + w > b[i] && y < b[i + 3] && y + h > b[i + 1]) return false
    }
    b.push(x, y, x + w, y + h)
    return true
  }
}

/** Dessine une étiquette (texte centré ou à droite d'un point) si la place est libre. */
export function drawLabel(f: FrameContext, text: string, x: number, y: number, color: string, opts: { size?: number; weight?: number; align?: 'center' | 'left'; dx?: number; dy?: number } = {}): boolean {
  const size = opts.size ?? 11
  const { ctx } = f
  ctx.font = `${opts.weight ?? 500} ${size}px ${FONT}`
  const w = ctx.measureText(text).width
  const align = opts.align ?? 'left'
  const lx = (align === 'center' ? x - w / 2 : x) + (opts.dx ?? 0)
  const ly = y + (opts.dy ?? 0)
  if (lx < 2 || lx + w > f.width - 2 || ly - size < 2 || ly > f.height - 2) return false
  if (!f.labels.reserve(lx - 2, ly - size, w + 4, size + 3)) return false
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (f.transparent) {
    // Lisibilité sur le ciel filmé (crépuscule, pollution lumineuse) : halo noir (G = B = 0 en red-night).
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 4
    ctx.fillText(text, lx, ly)
    ctx.shadowBlur = 0
    ctx.shadowColor = 'rgba(0, 0, 0, 0)'
  } else ctx.fillText(text, lx, ly)
  return true
}

/**
 * Trace une polyligne de vecteurs ENU (tableau plat) en coupant le tracé
 * quand un sommet sort du domaine projetable ou qu'un saut dépasse `maxJumpPx`.
 */
export function strokePolyline(f: FrameContext, enu: ArrayLike<number>, maxJumpPx = f.width * 0.6): void {
  const { ctx, proj } = f
  ctx.beginPath()
  let prev: { x: number; y: number } | null = null
  for (let i = 0; i < enu.length; i += 3) {
    const s = projectXYZ(proj, enu[i], enu[i + 1], enu[i + 2])
    if (!s) {
      prev = null
      continue
    }
    if (prev && Math.hypot(s.x - prev.x, s.y - prev.y) < maxJumpPx) ctx.lineTo(s.x, s.y)
    else ctx.moveTo(s.x, s.y)
    prev = s
  }
  ctx.stroke()
}

/** Pixels CSS par radian au voisinage d'un point d'écart `cosFromCenter` au centre. */
export function localPxPerRad(proj: Projector, cosFromCenter: number): number {
  if (proj.kind === 'gnomonic') return proj.scale / Math.max(0.05, cosFromCenter * cosFromCenter)
  return proj.kind === 'stereographic' ? (proj.scale * 2) / (1 + cosFromCenter) : proj.scale
}
