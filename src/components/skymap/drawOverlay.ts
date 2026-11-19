/**
 * Surcouche instrumentale : réticule fin au centre, anneau de sélection et
 * guidage (crochets autour de la cible si visible, flèche directionnelle en
 * bord d'écran sinon, réticule plein quand la cible est pointée).
 */
import { guidanceReading, lockRadiusDeg } from '../../services/sky/guidance'
import { project } from '../../services/sky/projection'
import type { Vec3 } from '../../types/sky'
import { FONT, localPxPerRad, type FreeBounds, type FrameContext } from './frame'

export function drawReticle(f: FrameContext, locked: boolean): void {
  const { ctx, p } = f
  const cx = f.width / 2
  const cy = f.height / 2
  const color = locked ? p.sky.guidance : p.sky.reticle
  ctx.strokeStyle = color
  ctx.lineWidth = locked ? 1.6 : 1
  ctx.beginPath()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(cx + dx * 7, cy + dy * 7)
    ctx.lineTo(cx + dx * 18, cy + dy * 18)
  }
  ctx.stroke()
  // Cercle du rayon de capture : la cible est « pointée » quand elle y entre.
  const rPx = ((lockRadiusDeg(f.view.fovDeg) * Math.PI) / 180) * localPxPerRad(f.proj, 1)
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(10, rPx), 0, Math.PI * 2)
  ctx.setLineDash(locked ? [] : [2, 3])
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawSelection(f: FrameContext, dir: Vec3): void {
  const s = project(f.proj, dir)
  if (!s) return
  const { ctx, p } = f
  const pulse = 1 + 0.08 * Math.sin(f.timeSec * 4)
  ctx.strokeStyle = p.accent
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(s.x, s.y, 14 * pulse, 0, Math.PI * 2)
  ctx.stroke()
}

/** Guidage : crochets si la cible est à l'écran, flèche en bord d'écran sinon. */
export function drawGuidance(f: FrameContext, target: Vec3, locked: boolean, free: FreeBounds): void {
  const { ctx, p, proj } = f
  const reading = guidanceReading(proj.basis, target)
  const s = project(proj, target)
  const margin = 40
  const box = { l: free.left + margin, r: free.right - margin, t: free.top + margin, b: free.bottom - margin }
  const onScreen = s && s.x > box.l && s.x < box.r && s.y > box.t && s.y < box.b
  ctx.strokeStyle = p.sky.guidance
  ctx.fillStyle = p.sky.guidance
  if (onScreen && s) {
    const k = locked ? 20 : 26 + 4 * Math.sin(f.timeSec * 5)
    ctx.lineWidth = 2
    ctx.beginPath()
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(s.x + sx * k, s.y + sy * (k - 8))
      ctx.lineTo(s.x + sx * k, s.y + sy * k)
      ctx.lineTo(s.x + sx * (k - 8), s.y + sy * k)
    }
    ctx.stroke()
    if (!locked) {
      ctx.setLineDash([3, 4])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(f.width / 2, f.height / 2)
      ctx.lineTo(s.x, s.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    return
  }
  // Flèche au bord de la zone libre, sur le rayon centre → cible (écran : y vers le bas).
  const a = reading.screenAngleRad
  const cx = f.width / 2
  const cy = f.height / 2
  const dx = Math.cos(a)
  const dy = -Math.sin(a)
  const t = Math.min(
    dx > 1e-9 ? (box.r - cx) / dx : dx < -1e-9 ? (box.l - cx) / dx : Infinity,
    dy > 1e-9 ? (box.b - cy) / dy : dy < -1e-9 ? (box.t - cy) / dy : Infinity,
  )
  const ax = cx + dx * t
  const ay = cy + dy * t
  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate(-a)
  ctx.beginPath()
  ctx.moveTo(18, 0)
  ctx.lineTo(-10, -13)
  ctx.lineTo(-4, 0)
  ctx.lineTo(-10, 13)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  // Distance sur pastille opaque : lisible au-dessus des étoiles et étiquettes.
  const text = `${Math.round(reading.separationDeg)}°`
  ctx.font = `600 13px ${FONT}`
  const tw = ctx.measureText(text).width
  const lx = ax - Math.cos(a) * 36
  const ly = ay + Math.sin(a) * 36
  ctx.fillStyle = p.surface
  ctx.strokeStyle = p.sky.guidance
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(lx - tw / 2 - 7, ly - 10, tw + 14, 20, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = p.sky.guidance
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, lx, ly + 0.5)
}
