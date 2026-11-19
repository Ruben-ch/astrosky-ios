/**
 * Garde-fou de la vision nocturne : toute couleur du thème red-night (CSS et
 * palettes Canvas/WebGL) doit être un rouge pur #XX0000 / rgba(R, 0, 0, a),
 * à la seule exception de l'accent principal #FF2A2A.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RED_NIGHT_PALETTE } from '../palette'
import { starColor } from '../starColor'

const ACCENT = '#FF2A2A'
// Lecture directe depuis la racine du projet : Vitest neutralise les imports CSS
// (même `?raw`) et, sous jsdom, `import.meta.url` n'est pas une URL file://.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

function isPureRed(color: string): boolean {
  if (color.toUpperCase() === ACCENT) return true
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (hex) return hex[2] === '00' && hex[3] === '00'
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color)
  if (rgb) return rgb[2] === '0' && rgb[3] === '0'
  return false
}

function collect(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collect)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collect)
  return []
}

describe('thème red-night', () => {
  it('palette Canvas/WebGL en rouges purs', () => {
    const colors = collect(RED_NIGHT_PALETTE)
    expect(colors.length).toBeGreaterThan(20)
    for (const c of colors) expect(isPureRed(c), c).toBe(true)
  })

  it('variables CSS [data-theme="red-night"] en rouges purs', () => {
    const block = /\[data-theme="red-night"\]\s*\{([^}]*)\}/.exec(css)?.[1]
    expect(block).toBeDefined()
    const colors = [...block!.matchAll(/(#[0-9a-f]{6}|rgba?\([^)]*\))/gi)].map((m) => m[1])
    expect(colors.length).toBeGreaterThan(10)
    for (const c of colors) expect(isPureRed(c), c).toBe(true)
  })

  it('couleur des étoiles réduite au canal rouge', () => {
    for (const bv of [-0.3, 0, 0.65, 1.5, null]) expect(isPureRed(starColor(bv, 'red-night'))).toBe(true)
  })
})
