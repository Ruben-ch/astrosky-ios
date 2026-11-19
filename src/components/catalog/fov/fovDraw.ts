/**
 * Rendu Canvas 2D du simulateur de champ : fond de ciel, objets et étoiles
 * réels à l'échelle (projection gnomonique), vignettage hors champ, diaphragme
 * de champ gradué (visuel) ou cadre capteur orientable (photo), barre
 * d'échelle et boussole N/E. Fonction pure : palette injectée.
 */
import type { FieldNeighbor } from '../../../services/optics/fieldProjection'
import type { FovPalette } from '../../../theme/palette'
import type { ImageOrientation } from '../../../types/fov'
import { drawSilhouette, type SilhouetteSpec } from './silhouetteDraw'

const DEG = Math.PI / 180

export type FovMain =
  | { readonly kind: 'dso'; readonly spec: Omit<SilhouetteSpec, 'rxPx' | 'ryPx' | 'rotationRad'>; readonly majorArcmin: number; readonly minorArcmin: number; readonly paDeg: number }
  | { readonly kind: 'disk'; readonly diameterArcmin: number }
  | { readonly kind: 'star' }

export interface FovScene {
  readonly spanArcmin: number
  readonly field: { readonly kind: 'circle'; readonly diameterArcmin: number } | { readonly kind: 'rect'; readonly widthArcmin: number; readonly heightArcmin: number; readonly rotationDeg: number }
  readonly orientation: ImageOrientation
  readonly main: FovMain
  readonly neighbors: readonly FieldNeighbor[]
}

/** Signes écran (x, y) appliqués aux axes (est, nord) selon l'orientation de l'image. */
export function orientationSigns(o: ImageOrientation): { sx: number; sy: number } {
  if (o === 'inverted') return { sx: 1, sy: 1 }
  if (o === 'mirrored') return { sx: 1, sy: -1 }
  return { sx: -1, sy: -1 } // ciel : nord en haut, est à gauche
}

/** Angle canvas d'une direction d'angle de position `paDeg` (nord → est). */
export function screenAngle(paDeg: number, o: ImageOrientation): number {
  const { sx, sy } = orientationSigns(o)
  return Math.atan2(sy * Math.cos(paDeg * DEG), sx * Math.sin(paDeg * DEG))
}

/** Valeur ronde de barre d'échelle (arcmin) proche du quart de l'étendue. */
export function scaleBarArcmin(spanArcmin: number): number {
  const nice = [0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600]
  const target = spanArcmin / 4
  return nice.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), nice[0])
}

export const fmtArcmin = (a: number) =>
  a >= 60 ? `${(a / 60).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}°` : `${a.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}′`

function fieldPath(ctx: CanvasRenderingContext2D, scene: FovScene, cx: number, cy: number, k: number) {
  const f = scene.field
  if (f.kind === 'circle') {
    ctx.arc(cx, cy, (f.diameterArcmin / 2) * k, 0, Math.PI * 2)
    return
  }
  // Grand côté orienté à `rotationDeg` du nord vers l'est ; rotation 0 = grand côté horizontal.
  const ang = screenAngle(90 + f.rotationDeg, 'sky')
  const hw = (f.widthArcmin / 2) * k
  const hh = (f.heightArcmin / 2) * k
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const pts: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
  pts.forEach(([x, y], i) => {
    const px = cx + x * c - y * s
    const py = cy + x * s + y * c
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

function drawNeighbors(ctx: CanvasRenderingContext2D, scene: FovScene, toScreen: (e: number, n: number) => [number, number], k: number, p: FovPalette) {
  ctx.font = '500 10px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const nb of scene.neighbors) {
    const [x, y] = toScreen(nb.eastArcmin, nb.northArcmin)
    if (nb.kind === 'star') {
      ctx.fillStyle = p.star
      const r = Math.max(1, 3.2 - nb.star.mag * 0.55)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    const o = nb.entry.object
    const major = o.sizeMajorArcmin ?? 1
    const minor = o.sizeMinorArcmin ?? major
    drawSilhouette(ctx, x, y, {
      type: o.type, seed: o.id, rxPx: (major / 2) * k, ryPx: (minor / 2) * k,
      rotationRad: screenAngle(nb.entry.positionAngleDeg ?? 90, scene.orientation),
    }, p)
    ctx.fillStyle = p.neighbor
    ctx.fillText(nb.entry.code, x + Math.max(6, (minor / 2) * k + 4), y)
  }
}

function drawFieldStop(ctx: CanvasRenderingContext2D, scene: FovScene, cx: number, cy: number, k: number, p: FovPalette) {
  const f = scene.field
  ctx.strokeStyle = f.kind === 'circle' ? p.fieldStop : p.frame
  ctx.lineWidth = 1.5
  ctx.beginPath()
  fieldPath(ctx, scene, cx, cy, k)
  ctx.stroke()
  ctx.strokeStyle = p.reticle
  ctx.lineWidth = 0.75
  if (f.kind === 'circle') {
    const r = (f.diameterArcmin / 2) * k
    // Graduations du diaphragme tous les 10°, plus longues tous les 30°.
    ctx.strokeStyle = p.tick
    for (let a = 0; a < 360; a += 10) {
      const len = a % 30 === 0 ? 9 : 4
      const c = Math.cos(a * DEG)
      const s = Math.sin(a * DEG)
      ctx.beginPath()
      ctx.moveTo(cx + c * r, cy + s * r)
      ctx.lineTo(cx + c * (r - len), cy + s * (r - len))
      ctx.stroke()
    }
    ctx.strokeStyle = p.reticle
    const gap = 10
    ctx.beginPath()
    ctx.moveTo(cx - r + 12, cy); ctx.lineTo(cx - gap, cy)
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + r - 12, cy)
    ctx.moveTo(cx, cy - r + 12); ctx.lineTo(cx, cy - gap)
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + r - 12)
    ctx.stroke()
  } else {
    // Croix centrale et tiers du cadre, dans le repère du capteur.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(screenAngle(90 + f.rotationDeg, 'sky'))
    const hw = (f.widthArcmin / 2) * k
    const hh = (f.heightArcmin / 2) * k
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    for (const t of [-1 / 3, 1 / 3]) {
      ctx.moveTo(t * 2 * hw, -hh); ctx.lineTo(t * 2 * hw, hh)
      ctx.moveTo(-hw, t * 2 * hh); ctx.lineTo(hw, t * 2 * hh)
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8)
    ctx.stroke()
    ctx.strokeStyle = p.frame
    ctx.lineWidth = 2.5
    const b = Math.min(14, hw / 3, hh / 3)
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath()
      ctx.moveTo(sx * hw, sy * (hh - b)); ctx.lineTo(sx * hw, sy * hh); ctx.lineTo(sx * (hw - b), sy * hh)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawOverlays(ctx: CanvasRenderingContext2D, scene: FovScene, w: number, h: number, k: number, p: FovPalette) {
  // Barre d'échelle (bas gauche).
  const bar = scaleBarArcmin(scene.spanArcmin)
  const len = bar * k
  ctx.strokeStyle = p.label
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(12, h - 14); ctx.lineTo(12 + len, h - 14)
  ctx.moveTo(12, h - 18); ctx.lineTo(12, h - 10)
  ctx.moveTo(12 + len, h - 18); ctx.lineTo(12 + len, h - 10)
  ctx.stroke()
  ctx.fillStyle = p.label
  ctx.font = '600 11px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(fmtArcmin(bar), 12, h - 20)

  // Boussole (haut droite) : nord et est selon l'orientation.
  const { sx, sy } = orientationSigns(scene.orientation)
  const ox = w - 40
  const oy = 40
  const L = 16
  ctx.strokeStyle = p.compass
  ctx.fillStyle = p.compass
  ctx.lineWidth = 1.5
  ctx.font = '700 10px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [dx, dy, label] of [[0, sy * L, 'N'], [sx * L, 0, 'E']] as const) {
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ox + dx, oy + dy)
    ctx.stroke()
    ctx.fillText(label, ox + dx * 1.6, oy + dy * 1.6)
  }
}

/** Dessine la scène complète dans un canevas `w × h` (pixels CSS). */
export function drawFovScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: FovScene, p: FovPalette, background: string): void {
  const cx = w / 2
  const cy = h / 2
  const k = Math.min(w, h) / scene.spanArcmin
  const { sx, sy } = orientationSigns(scene.orientation)
  const toScreen = (east: number, north: number): [number, number] => [cx + sx * east * k, cy + sy * north * k]

  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = p.field
  ctx.beginPath()
  fieldPath(ctx, scene, cx, cy, k)
  ctx.fill()

  drawNeighbors(ctx, scene, toScreen, k, p)
  const m = scene.main
  if (m.kind === 'dso') {
    drawSilhouette(ctx, cx, cy, {
      ...m.spec, rxPx: (m.majorArcmin / 2) * k, ryPx: (m.minorArcmin / 2) * k, rotationRad: screenAngle(m.paDeg, scene.orientation),
    }, p)
  } else if (m.kind === 'disk') {
    const r = Math.max(1.5, (m.diameterArcmin / 2) * k)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, p.objectCore)
    g.addColorStop(0.85, p.objectCore)
    g.addColorStop(1, p.objectHalo)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = p.star
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Vignettage hors champ (règle pair-impair : le champ reste découvert).
  ctx.fillStyle = p.vignette
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  fieldPath(ctx, scene, cx, cy, k)
  ctx.fill('evenodd')

  drawFieldStop(ctx, scene, cx, cy, k, p)
  drawOverlays(ctx, scene, w, h, k, p)
}
