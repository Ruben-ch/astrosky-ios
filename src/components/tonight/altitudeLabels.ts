/**
 * Placement anti-chevauchement des étiquettes de courbes d'altitude.
 * Les étiquettes sont placées par priorité (astre mis en avant, puis le plus
 * brillant) au-dessus de leur point culminant ; en cas de collision, elles sont
 * décalées verticalement en alternance (au-dessus / au-dessous, de plus en plus
 * loin) puis latéralement, avec un trait de rappel vers le point d'ancrage.
 * Fonction pure, en pixels CSS : aucune dépendance au Canvas.
 */

export interface LabelRequest {
  readonly id: string
  /** Point d'ancrage (culmination de la courbe), px CSS. */
  readonly x: number
  readonly y: number
  /** Largeur mesurée du texte, px CSS. */
  readonly width: number
  /** Plus petit = placé en premier (prioritaire). */
  readonly priority: number
}

export interface PlacedCurveLabel {
  readonly id: string
  /** Centre horizontal et ligne de base du texte. */
  readonly x: number
  readonly baselineY: number
  /** Le texte est éloigné de son ancrage : tracer un trait de rappel. */
  readonly leader: boolean
}

export interface PlotBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

const LABEL_H = 12
const GAP = 3
const PAD = 2

interface Box { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Décalages candidats (dx, dy de la ligne de base par rapport à « juste au-dessus »). */
function offsets(): [number, number][] {
  const out: [number, number][] = [[0, 0]]
  const steps = [1, 2, 3]
  for (const k of steps) {
    out.push([0, -k * (LABEL_H + 2)])
    out.push([0, k * (LABEL_H + 2) + LABEL_H + 2 * GAP])
  }
  for (const dx of [-28, 28, -52, 52]) for (const dy of [0, -(LABEL_H + 2), LABEL_H + 2 * GAP]) out.push([dx, dy])
  return out
}
const OFFSETS = offsets()

export function placeCurveLabels(requests: readonly LabelRequest[], bounds: PlotBounds): PlacedCurveLabel[] {
  const placed: PlacedCurveLabel[] = []
  const boxes: Box[] = []
  const sorted = [...requests].sort((a, b) => a.priority - b.priority)
  for (const r of sorted) {
    const half = r.width / 2
    const baseX = Math.min(bounds.right - half - PAD, Math.max(bounds.left + half + PAD, r.x))
    const baseY = r.y - GAP
    for (const [dx, dy] of OFFSETS) {
      const cx = Math.min(bounds.right - half - PAD, Math.max(bounds.left + half + PAD, baseX + dx))
      const by = baseY + dy
      const box = { x0: cx - half - PAD, y0: by - LABEL_H, x1: cx + half + PAD, y1: by + 2 }
      if (box.y0 < bounds.top || box.y1 > bounds.bottom) continue
      if (boxes.some((b) => overlaps(b, box))) continue
      boxes.push(box)
      placed.push({ id: r.id, x: cx, baselineY: by, leader: dx !== 0 || dy !== 0 })
      break
    }
  }
  return placed
}
