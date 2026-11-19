/**
 * Placement des étiquettes HTML du Système Solaire 3D : par ordre de priorité
 * (sélection, Soleil, planètes géantes → telluriques, lunes), chaque astre visible
 * reçoit son nom à droite, à gauche, au-dessus ou au-dessous de son disque — la
 * première position qui ne chevauche ni une étiquette déjà placée, ni le disque
 * d'un autre astre, ni le bord de l'écran. Sinon l'étiquette est omise.
 * Les lunes ne sont étiquetées qu'en vue rapprochée de Jupiter (ou sélectionnées) ;
 * la couronne du Soleil compte comme obstacle (rayon × SUN_HALO).
 */
import { ORRERY_NAME_FR } from '../../data/solarSystemPhysical'
import type { OrreryBodyId, ScreenPick } from '../../types/orrery'

const PRIORITY: readonly OrreryBodyId[] = [
  'Sun', 'Jupiter', 'Saturn', 'Earth', 'Mars', 'Venus', 'Uranus', 'Neptune', 'Mercury', 'Ganymede', 'Callisto', 'Io', 'Europa',
]
const MOONS: readonly OrreryBodyId[] = ['Io', 'Europa', 'Ganymede', 'Callisto']
const CHAR_PX = 6.6
const LABEL_H = 15
const PAD = 4
/** Rayon apparent de la couronne du Soleil rapporté à son disque. */
const SUN_HALO = 1.7
/** Rayon d'écran (px) de l'orbite de Callisto au-delà duquel les lunes sont étiquetées. */
export const MOON_LABEL_MIN_PX = 90

export interface LabelOptions {
  /** Rayon apparent de l'orbite de Callisto (px CSS). */
  readonly moonSystemPx: number
  /** Largeur mesurée de l'étiquette (px CSS), sinon estimation par caractère. */
  readonly measure?: (id: OrreryBodyId) => number | undefined
}

export interface PlacedLabel {
  readonly id: OrreryBodyId
  readonly x: number
  readonly y: number
}

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Le disque (cx, cy, r) coupe-t-il le rectangle ? */
function hitsDisk(rect: Rect, p: ScreenPick): boolean {
  const nx = Math.min(Math.max(p.x, rect.x0), rect.x1)
  const ny = Math.min(Math.max(p.y, rect.y0), rect.y1)
  return Math.hypot(nx - p.x, ny - p.y) < obstacleRadius(p)
}

const obstacleRadius = (p: ScreenPick) => (p.id === 'Sun' ? p.radiusPx * SUN_HALO : p.radiusPx)

/** Positions candidates (coin haut-gauche) autour d'un disque, par ordre de préférence. */
function candidates(p: ScreenPick, w: number): [number, number][] {
  const gap = obstacleRadius(p) + 3
  return [
    [p.x + gap, p.y - LABEL_H / 2],
    [p.x - gap - w, p.y - LABEL_H / 2],
    [p.x - w / 2, p.y - gap - LABEL_H],
    [p.x - w / 2, p.y + gap],
  ]
}

export function layoutLabels(picks: readonly ScreenPick[], selected: OrreryBodyId | null, width: number, height: number, opts: LabelOptions = { moonSystemPx: Infinity }): PlacedLabel[] {
  const byId = new Map(picks.map((p) => [p.id, p]))
  const moonLabels = opts.moonSystemPx >= MOON_LABEL_MIN_PX
  const order = selected ? [selected, ...PRIORITY.filter((id) => id !== selected)] : PRIORITY
  const placed: PlacedLabel[] = []
  const labelRects: Rect[] = []
  for (const id of order) {
    const p = byId.get(id)
    if (!p) continue
    if (MOONS.includes(id) && !moonLabels && id !== selected) continue
    const w = opts.measure?.(id) ?? ORRERY_NAME_FR[id].length * CHAR_PX + PAD * 2
    for (const [x, y] of candidates(p, w)) {
      const rect = { x0: x, y0: y, x1: x + w, y1: y + LABEL_H }
      if (rect.x0 < 0 || rect.y0 < 0 || rect.x1 > width || rect.y1 > height) continue
      if (labelRects.some((r) => overlaps(r, rect))) continue
      if (picks.some((o) => o.id !== id && hitsDisk(rect, o))) continue
      labelRects.push(rect)
      placed.push({ id, x, y })
      break
    }
  }
  return placed
}
