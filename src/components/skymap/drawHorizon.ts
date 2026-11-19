/**
 * Sol et horizon. En stéréographique, l'horizon (grand cercle) se projette
 * exactement en cercle : centre (2nx/nz, 2ny/nz), rayon 2/|nz| où n est le
 * zénith exprimé dans la base de vue — le sol est l'intérieur si le centre de
 * vue est sous l'horizon (nz < 0), l'extérieur sinon ; droite si nz ≈ 0.
 * En équidistante, l'horizon est échantillonné en polygone.
 */
import { projectXYZ, type Projector } from '../../services/sky/projection'
import { fromHorizontal } from '../../services/sky/vector'
import { drawLabel, strokePolyline, type FrameContext } from './frame'

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

/** Trace le contour de l'horizon dans le chemin courant ; renvoie `true` si le sol est « intérieur ». */
function horizonPath(f: FrameContext, proj: Projector): boolean | null {
  const { ctx } = f
  const { f: F, r: R, u: U } = proj.basis
  const nx = R[2], ny = U[2], nz = F[2]
  if (proj.kind === 'stereographic') {
    if (Math.abs(nz) < 1e-4) {
      // Horizon passant par l'antipode du centre : droite nx·X + ny·Y = 0 ; sol du côté opposé à (nx, ny).
      const big = 1e5
      const tx = -ny, ty = nx
      const gx = -nx, gy = -ny // direction du sol dans le plan projeté
      const pts = [
        [tx * big, ty * big],
        [tx * big + gx * big, ty * big + gy * big],
        [-tx * big + gx * big, -ty * big + gy * big],
        [-tx * big, -ty * big],
      ]
      pts.forEach(([X, Y], i) => (i === 0 ? ctx.moveTo(proj.cx + X, proj.cy - Y) : ctx.lineTo(proj.cx + X, proj.cy - Y)))
      ctx.closePath()
      return true
    }
    const cx = proj.cx + ((2 * nx) / nz) * proj.scale
    const cy = proj.cy - ((2 * ny) / nz) * proj.scale
    ctx.arc(cx, cy, (2 / Math.abs(nz)) * proj.scale, 0, Math.PI * 2)
    return nz < 0
  }
  let started = false
  for (let az = 0; az <= 360; az += 1) {
    const v = fromHorizontal(az, 0)
    const s = projectXYZ({ ...proj, minCos: -0.999 }, v[0], v[1], v[2])
    if (!s) continue
    if (!started) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
    started = true
  }
  if (!started) return null
  ctx.closePath()
  return nz < 0
}

export function drawGround(f: FrameContext): void {
  const { ctx, p, proj } = f
  // Gnomonique (Caméra AR) : le vrai sol est filmé, et l'échantillonnage arrière divergerait.
  if (proj.kind === 'gnomonic') return
  ctx.save()
  ctx.beginPath()
  const inside = horizonPath(f, proj)
  if (inside === null) {
    ctx.restore()
    return
  }
  if (!inside) ctx.rect(-10, -10, f.width + 20, f.height + 20)
  ctx.fillStyle = p.sky.ground
  ctx.fill(inside ? 'nonzero' : 'evenodd')
  ctx.restore()
}

/** Ligne d'horizon, micro-graduations d'azimut (10° / 30°) et points cardinaux. */
export function drawHorizonLine(f: FrameContext): void {
  const { ctx, p, proj } = f
  ctx.strokeStyle = p.sky.horizon
  ctx.lineWidth = 1.2
  const buf: number[] = []
  for (let az = 0; az <= 360; az += 1) buf.push(...fromHorizontal(az, 0))
  strokePolyline(f, buf)

  ctx.lineWidth = 1
  ctx.beginPath()
  const tickStep = f.view.fovDeg < 30 ? 2 : f.view.fovDeg < 80 ? 5 : 10
  for (let az = 0; az < 360; az += tickStep) {
    const a = fromHorizontal(az, 0)
    const major = az % 30 === 0
    const b = fromHorizontal(az, major ? f.view.fovDeg * 0.018 : f.view.fovDeg * 0.009)
    const s0 = projectXYZ(proj, a[0], a[1], a[2])
    const s1 = projectXYZ(proj, b[0], b[1], b[2])
    if (!s0 || !s1) continue
    ctx.moveTo(s0.x, s0.y)
    ctx.lineTo(s1.x, s1.y)
    if (major && az % 45 !== 0) drawLabel(f, `${az}°`, s0.x, s0.y, p.textDim, { size: 9, align: 'center', dy: 13 })
  }
  ctx.stroke()

  CARDINALS.forEach((name, i) => {
    const v = fromHorizontal(i * 45, 0)
    const s = projectXYZ(proj, v[0], v[1], v[2])
    if (s) drawLabel(f, name, s.x, s.y, p.sky.cardinal, { size: name.length === 1 ? 15 : 12, weight: 700, align: 'center', dy: 18 })
  })
}
