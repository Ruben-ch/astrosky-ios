/**
 * Objets du ciel profond (symboles normalisés par type, taille angulaire réelle)
 * et astres du système solaire (Soleil, Lune avec phase orientée vers le Soleil,
 * planètes) — tous sélectionnables.
 */
import { deepSkyRef } from '../../services/sky/skyObjects'
import type { SkyObjectRef } from '../../types/sky'
import type { DeepSkyObject } from '../../types/catalog'
import type { SolarSystemBodyId } from '../../types/astro'
import { projectXYZ } from '../../services/sky/projection'
import { starRadiusPx } from '../../services/sky/skyStyle'
import { drawLabel, localPxPerRad, type FrameContext } from './frame'

/** Étiquette de ciel profond différée : placée après les astres et les constellations (moins prioritaire). */
export interface DeferredLabel {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly dx: number
}

/**
 * Niveau de détail selon le champ (degrés) : magnitude limite des objets
 * Messier et NGC/IC affichés. Champ large → seuls les Messier majeurs.
 */
export function deepSkyLod(fovDeg: number): { messierMag: number; ngcMag: number; minSepPx: number } {
  if (fovDeg > 55) return { messierMag: 8.5, ngcMag: -Infinity, minSepPx: 14 }
  if (fovDeg > 30) return { messierMag: Infinity, ngcMag: 10, minSepPx: 10 }
  if (fovDeg > 15) return { messierMag: Infinity, ngcMag: 12, minSepPx: 6 }
  return { messierMag: Infinity, ngcMag: Infinity, minSepPx: 0 }
}

const brightOrder = new WeakMap<readonly DeepSkyObject[], Uint32Array>()
/** Indices triés du plus brillant au plus faible (calculé une fois par catalogue). */
function orderByBrightness(objects: readonly DeepSkyObject[]): Uint32Array {
  let order = brightOrder.get(objects)
  if (!order) {
    order = Uint32Array.from(objects.keys()).sort((a, b) => (objects[a].mag ?? 99) - (objects[b].mag ?? 99))
    brightOrder.set(objects, order)
  }
  return order
}

export function drawDeepSky(f: FrameContext, objects: readonly DeepSkyObject[], enu: Float64Array): DeferredLabel[] {
  const { ctx, proj, view, p } = f
  const lod = deepSkyLod(view.fovDeg)
  const labelAll = view.fovDeg < 40
  const drawn: number[] = []
  const labels: DeferredLabel[] = []
  ctx.strokeStyle = p.sky.deepSky
  ctx.lineWidth = 1
  const order = orderByBrightness(objects)
  for (let k = 0; k < order.length; k++) {
    const i = order[k]
    const o = objects[i]
    const mag = o.mag ?? (o.messier !== null ? 9 : 99)
    if (mag > (o.messier !== null ? lod.messierMag : lod.ngcMag)) continue
    const pt = projectXYZ(proj, enu[i * 3], enu[i * 3 + 1], enu[i * 3 + 2])
    if (!pt || pt.x < -20 || pt.x > f.width + 20 || pt.y < -20 || pt.y > f.height + 20) continue
    // Désencombrement : un objet plus faible trop proche d'un objet déjà dessiné est omis.
    if (lod.minSepPx > 0 && tooClose(drawn, pt.x, pt.y, lod.minSepPx)) continue
    drawn.push(pt.x, pt.y)
    const sizeRad = ((o.sizeMajorArcmin ?? 5) / 60) * (Math.PI / 180)
    const r = Math.min(80, Math.max(4.5, (sizeRad / 2) * localPxPerRad(proj, pt.cosFromCenter)))
    ctx.beginPath()
    switch (o.type) {
      case 'galaxy':
        ctx.ellipse(pt.x, pt.y, r, Math.max(2.5, r * ((o.sizeMinorArcmin ?? 1) / (o.sizeMajorArcmin ?? 1))), -0.5, 0, Math.PI * 2)
        break
      case 'globular-cluster':
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.moveTo(pt.x - r, pt.y)
        ctx.lineTo(pt.x + r, pt.y)
        ctx.moveTo(pt.x, pt.y - r)
        ctx.lineTo(pt.x, pt.y + r)
        break
      case 'open-cluster':
      case 'star-cloud':
      case 'asterism':
        ctx.setLineDash([2, 2])
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        break
      case 'planetary-nebula':
        ctx.arc(pt.x, pt.y, r * 0.6, 0, Math.PI * 2)
        for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
          ctx.moveTo(pt.x + Math.cos(a) * r * 0.6, pt.y + Math.sin(a) * r * 0.6)
          ctx.lineTo(pt.x + Math.cos(a) * r, pt.y + Math.sin(a) * r)
        }
        break
      default:
        ctx.rect(pt.x - r, pt.y - r, 2 * r, 2 * r)
    }
    ctx.stroke()
    ctx.setLineDash([])
    const ref = deepSkyRef(o)
    f.candidates.push({ x: pt.x, y: pt.y, ref, priority: 1 })
    if (labelAll || mag < 6.5) labels.push({ text: o.messier !== null ? `M${o.messier}` : (o.ngc ?? o.id), x: pt.x, y: pt.y, dx: r + 3 })
  }
  return labels
}

function tooClose(drawn: readonly number[], x: number, y: number, minPx: number): boolean {
  const m2 = minPx * minPx
  for (let j = 0; j < drawn.length; j += 2) {
    const dx = drawn[j] - x
    const dy = drawn[j + 1] - y
    if (dx * dx + dy * dy < m2) return true
  }
  return false
}

/** Étiquettes DSO placées en dernier : elles cèdent la place aux astres et aux constellations. */
export function drawDeepSkyLabels(f: FrameContext, labels: readonly DeferredLabel[]): void {
  for (const l of labels) drawLabel(f, l.text, l.x, l.y, f.p.sky.deepSkyLabel, { size: 10, dx: l.dx, dy: 3 })
}

export interface BodyFrame {
  readonly id: SolarSystemBodyId
  readonly ref: SkyObjectRef
  readonly enu: readonly [number, number, number]
  readonly magnitude: number
  readonly angularDiameterArcsec: number
  /** Angle de phase géocentrique Lune − Soleil, degrés (Lune uniquement). */
  readonly phaseAngleDeg: number
}

function drawMoonDisc(f: FrameContext, x: number, y: number, r: number, phaseAngleDeg: number, toSunRad: number): void {
  const { ctx, p } = f
  ctx.fillStyle = p.moonDark
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  const k = Math.cos((phaseAngleDeg * Math.PI) / 180) // 1 = nouvelle, −1 = pleine
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(toSunRad)
  ctx.fillStyle = p.moonLit
  ctx.beginPath()
  // Demi-limbe éclairé tourné vers le Soleil (axe +x local), retour par le terminateur.
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false)
  ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0)
  ctx.fill()
  ctx.restore()
}

export function drawSolarSystem(f: FrameContext, bodies: readonly BodyFrame[]): void {
  const { ctx, proj, p } = f
  const sun = bodies.find((b) => b.id === 'Sun')
  for (const b of bodies) {
    const pt = projectXYZ(proj, b.enu[0], b.enu[1], b.enu[2])
    if (!pt || pt.x < -30 || pt.x > f.width + 30 || pt.y < -30 || pt.y > f.height + 30) continue
    const discR = ((b.angularDiameterArcsec / 3600) * (Math.PI / 180) * localPxPerRad(proj, pt.cosFromCenter)) / 2
    const color = p.bodies[b.id]
    let r: number
    if (b.id === 'Moon' || b.id === 'Sun') {
      r = Math.max(7, discR)
      if (b.id === 'Sun') {
        ctx.fillStyle = p.sky.halo
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r * 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Direction du Soleil dans le plan de l'écran (composantes droite/haut de la base).
        const s = sun?.enu ?? b.enu
        const { r: R, u: U } = proj.basis
        const toSun = Math.atan2(-(s[0] * U[0] + s[1] * U[1] + s[2] * U[2] - (b.enu[0] * U[0] + b.enu[1] * U[1] + b.enu[2] * U[2])), s[0] * R[0] + s[1] * R[1] + s[2] * R[2] - (b.enu[0] * R[0] + b.enu[1] * R[1] + b.enu[2] * R[2]))
        drawMoonDisc(f, pt.x, pt.y, r, b.phaseAngleDeg, toSun)
        ctx.strokeStyle = p.gridStrong
        ctx.lineWidth = 0.75
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else {
      r = Math.max(2.6, discR, starRadiusPx(b.magnitude, f.view.fovDeg) * 1.15)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    f.candidates.push({ x: pt.x, y: pt.y, ref: b.ref, priority: 0 })
    drawLabel(f, b.ref.label, pt.x, pt.y, color, { size: 11, weight: 600, dx: r + 4, dy: 4 })
  }
}
