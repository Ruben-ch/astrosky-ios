/**
 * Étoiles (couleur selon l'indice B−V, taille photométrique, scintillation,
 * halo des plus brillantes), figures et noms des constellations, noms d'étoiles.
 */
import type { SkyCatalog } from '../../services/sky/skyCatalog'
import { starRef } from '../../services/sky/skyObjects'
import { limitingMagnitude, starRadiusPx, twinkleFactor } from '../../services/sky/skyStyle'
import { projectXYZ } from '../../services/sky/projection'
import { starColor } from '../../theme/starColor'
import type { ThemeName } from '../../theme/palette'
import { DEG } from '../../services/sky/vector'
import { FONT, drawLabel, type FrameContext } from './frame'

/** Indice B−V quantifié au dixième entre −0,4 et 2,0 ; dernier casier = inconnu. */
const BV_MIN = -0.4
const BV_BINS = 25
const UNKNOWN_BIN = BV_BINS

export function bvBin(bv: number): number {
  if (!Number.isFinite(bv)) return UNKNOWN_BIN
  return Math.min(BV_BINS - 1, Math.max(0, Math.round((bv - BV_MIN) * 10)))
}

const colorTables = new Map<ThemeName, string[]>()

/** Table des couleurs d'étoiles par casier B−V pour un thème (rouges purs en red-night). */
export function starColorTable(theme: ThemeName): string[] {
  let t = colorTables.get(theme)
  if (!t) {
    t = Array.from({ length: BV_BINS }, (_, i) => starColor(BV_MIN + i / 10, theme))
    t.push(starColor(null, theme))
    colorTables.set(theme, t)
  }
  return t
}

export function drawStars(f: FrameContext, cat: SkyCatalog, enu: Float64Array, bins: Uint8Array, raDec: Float32Array): void {
  const { ctx, proj, view } = f
  const s = cat.stars
  const colors = starColorTable(f.theme)
  const limit = limitingMagnitude(view.fovDeg)
  const pickLimit = view.fovDeg < 30 ? 6 : view.fovDeg < 70 ? 4.5 : 3.2
  const nameLimit = view.fovDeg < 25 ? 3.5 : view.fovDeg < 60 ? 2.5 : 1.6
  // Parcours du plus faible au plus brillant : les brillantes passent au-dessus.
  for (let i = s.count - 1; i >= 0; i--) {
    const mag = s.mag[i]
    if (mag > limit) continue
    const x = enu[i * 3], y = enu[i * 3 + 1], z = enu[i * 3 + 2]
    const pt = projectXYZ(proj, x, y, z)
    if (!pt || pt.x < -8 || pt.x > f.width + 8 || pt.y < -8 || pt.y > f.height + 8) continue
    const altDeg = Math.asin(z) / DEG
    const tw = twinkleFactor(s.phase[i], f.timeSec, altDeg, mag)
    const r = starRadiusPx(mag, view.fovDeg) * tw
    const color = colors[bins[i]]
    ctx.fillStyle = color
    if (r < 1) {
      // Étoile faible : point d'un pixel modulé en opacité (plus net qu'un disque minuscule).
      ctx.globalAlpha = Math.max(0.25, Math.min(1, r * r * 1.6))
      ctx.fillRect(pt.x - 0.6, pt.y - 0.6, 1.2, 1.2)
      ctx.globalAlpha = 1
    } else {
      if (mag < 1.2) {
        ctx.globalAlpha = 0.18 * tw
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r * 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const hip = s.hip[i]
    if (mag <= pickLimit) {
      const name = cat.starNames.get(hip) ?? null
      f.candidates.push({ x: pt.x, y: pt.y, ref: starRef(hip, raDec[i * 2], raDec[i * 2 + 1], mag, name), priority: mag < 1.5 ? 2 : 3 })
    }
    if (f.layers.starNames && mag <= nameLimit && altDeg > -1) {
      const name = cat.starNames.get(hip)
      if (name) drawLabel(f, name, pt.x, pt.y, f.p.sky.starLabel, { size: 10, dx: r + 3, dy: 3 })
    }
  }
}

/** Segments des figures : tracés seulement si les deux extrémités sont projetables. */
export function drawConstellationLines(f: FrameContext, lines: readonly Float64Array[]): void {
  const { ctx, proj } = f
  ctx.strokeStyle = f.p.sky.constellationLine
  ctx.lineWidth = f.view.fovDeg < 40 ? 1.1 : 0.8
  ctx.beginPath()
  const maxLen = f.width * 0.7
  for (const enu of lines) {
    let prev = projectXYZ(proj, enu[0], enu[1], enu[2])
    for (let i = 3; i < enu.length; i += 3) {
      const cur = projectXYZ(proj, enu[i], enu[i + 1], enu[i + 2])
      if (prev && cur && Math.hypot(cur.x - prev.x, cur.y - prev.y) < maxLen) {
        // Petit retrait aux extrémités : l'étoile reste dégagée (lisibilité instrumentale).
        const dx = cur.x - prev.x, dy = cur.y - prev.y
        const len = Math.hypot(dx, dy)
        const gap = Math.min(4, len / 4)
        if (len > 2 * gap) {
          ctx.moveTo(prev.x + (dx / len) * gap, prev.y + (dy / len) * gap)
          ctx.lineTo(cur.x - (dx / len) * gap, cur.y - (dy / len) * gap)
        }
      }
      prev = cur
    }
  }
  ctx.stroke()
}

export function drawConstellationNames(f: FrameContext, labels: readonly { name: string; enu: Float64Array }[]): void {
  const size = f.view.fovDeg > 100 ? 9 : 10.5
  for (const l of labels) {
    const pt = projectXYZ(f.proj, l.enu[0], l.enu[1], l.enu[2])
    if (!pt || l.enu[2] < -0.05) continue
    f.ctx.font = `600 ${size}px ${FONT}`
    drawLabel(f, l.name.toLocaleUpperCase('fr-FR'), pt.x, pt.y, f.p.sky.constellationLabel, { size, weight: 600, align: 'center' })
  }
}
