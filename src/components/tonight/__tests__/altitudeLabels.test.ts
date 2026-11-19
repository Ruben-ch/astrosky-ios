import { describe, expect, it } from 'vitest'
import { placeCurveLabels } from '../altitudeLabels'

const bounds = { left: 30, right: 320, top: 10, bottom: 180 }
const box = (l: { x: number; baselineY: number }, w: number) => ({ x0: l.x - w / 2 - 2, x1: l.x + w / 2 + 2, y0: l.baselineY - 12, y1: l.baselineY + 2 })

describe('étiquettes des courbes d’altitude', () => {
  it('écarte deux étiquettes au même point culminant (Jupiter / Mars) avec trait de rappel', () => {
    const placed = placeCurveLabels([
      { id: 'Mars', x: 200, y: 60, width: 26, priority: 1.1 },
      { id: 'Jupiter', x: 202, y: 61, width: 38, priority: -2.4 },
    ], bounds)
    expect(placed.map((p) => p.id)).toEqual(['Jupiter', 'Mars'])
    const [j, m] = placed
    expect(j.leader).toBe(false)
    expect(m.leader).toBe(true)
    const a = box(j, 38), b = box(m, 26)
    expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false)
  })

  it('reste dans le cadre du graphique et place les astres mis en avant d’abord', () => {
    const placed = placeCurveLabels([
      { id: 'Vénus', x: 318, y: 150, width: 30, priority: -4 },
      { id: 'Mercure', x: 316, y: 152, width: 42, priority: -0.5 },
      { id: 'Lune', x: 100, y: 12, width: 24, priority: -100 },
    ], bounds)
    expect(placed[0].id).toBe('Lune')
    for (const p of placed) {
      expect(p.x).toBeLessThanOrEqual(bounds.right)
      expect(p.baselineY - 12).toBeGreaterThanOrEqual(bounds.top)
    }
    expect(placed).toHaveLength(3)
  })
})
