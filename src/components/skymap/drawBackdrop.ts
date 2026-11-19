/**
 * Arrière-plan du planétarium : Voie lactée (taches lumineuses additives
 * issues des isophotes), grille altazimutale, grille équatoriale et écliptique.
 */
import { gridStepDeg } from '../../services/sky/skyStyle'
import { fromHorizontal } from '../../services/sky/vector'
import { project, projectXYZ } from '../../services/sky/projection'
import type { RenderPalette } from '../../theme/palette'
import { drawLabel, localPxPerRad, strokePolyline, type FrameContext } from './frame'

/** Opacité par niveau d'isophote (1 = contour pâle → 5 = cœur). */
const MW_ALPHA = [0, 0.05, 0.075, 0.1, 0.13, 0.17]

let spriteCache: { color: string; canvas: HTMLCanvasElement } | null = null

/** Tache floue (dégradé radial) teintée par la palette, recréée si la palette change. */
function milkyWaySprite(p: RenderPalette): HTMLCanvasElement {
  if (spriteCache?.color === p.sky.milkyWay) return spriteCache.canvas
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, p.sky.milkyWay)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  spriteCache = { color: p.sky.milkyWay, canvas: c }
  return c
}

export function drawMilkyWay(f: FrameContext, enu: Float64Array, level: Uint8Array, stepDeg: number): void {
  const { ctx, proj } = f
  const sprite = milkyWaySprite(f.p)
  const radiusRad = ((stepDeg * 1.6) * Math.PI) / 180
  // Le zoom étale la lumière : on atténue pour garder une brillance de surface stable.
  const zoomFade = Math.min(1, Math.max(0.35, f.view.fovDeg / 90))
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < level.length; i++) {
    const s = projectXYZ(proj, enu[i * 3], enu[i * 3 + 1], enu[i * 3 + 2])
    if (!s) continue
    const r = radiusRad * localPxPerRad(proj, s.cosFromCenter)
    if (s.x < -r || s.x > f.width + r || s.y < -r || s.y > f.height + r) continue
    ctx.globalAlpha = MW_ALPHA[level[i]] * zoomFade
    ctx.drawImage(sprite, s.x - r, s.y - r, 2 * r, 2 * r)
  }
  ctx.restore()
}

/** Grille altazimutale : almucantarats et verticaux au pas adaptatif, graduations au centre. */
export function drawAltAzGrid(f: FrameContext): void {
  const { ctx, p } = f
  const step = gridStepDeg(f.view.fovDeg)
  ctx.strokeStyle = p.sky.altAzGrid
  ctx.lineWidth = 0.75
  const buf: number[] = []
  for (let alt = -90 + step; alt < 90; alt += step) {
    if (alt === 0) continue // l'horizon est dessiné à part
    buf.length = 0
    for (let az = 0; az <= 360; az += 2) buf.push(...fromHorizontal(az, alt))
    strokePolyline(f, buf)
    const s = project(f.proj, fromHorizontal(f.view.azimuthDeg, alt))
    if (s) drawLabel(f, `${alt}°`, s.x, s.y, p.textDim, { size: 9, dx: 3, dy: -2 })
  }
  for (let az = 0; az < 360; az += Math.max(step, 5)) {
    buf.length = 0
    for (let alt = -88; alt <= 88; alt += 2) buf.push(...fromHorizontal(az, alt))
    strokePolyline(f, buf)
  }
}

/** Grille équatoriale J2000 (parallèles + cercles horaires) et équateur céleste renforcé. */
export function drawEquatorialGrid(f: FrameContext, lines: readonly { enu: Float64Array; label: string; isEquator: boolean }[]): void {
  const { ctx, p } = f
  for (const l of lines) {
    ctx.strokeStyle = l.isEquator ? p.sky.equator : p.sky.equatorialGrid
    ctx.lineWidth = l.isEquator ? 1.1 : 0.7
    strokePolyline(f, l.enu)
  }
  // Étiquettes d'ascension droite le long de l'équateur.
  const equator = lines.find((l) => l.isEquator)
  if (!equator) return
  for (let h = 0; h < 24; h += f.view.fovDeg > 90 ? 2 : 1) {
    const i = Math.round((h * 15) / 2) * 3
    const s = projectXYZ(f.proj, equator.enu[i], equator.enu[i + 1], equator.enu[i + 2])
    if (s) drawLabel(f, `${h}h`, s.x, s.y, p.sky.equator, { size: 9, dx: 3, dy: -3 })
  }
}

export function drawEcliptic(f: FrameContext, enu: Float64Array): void {
  const { ctx, p } = f
  ctx.save()
  ctx.strokeStyle = p.sky.ecliptic
  ctx.lineWidth = 1
  ctx.setLineDash([6, 5])
  strokePolyline(f, enu)
  ctx.restore()
}
