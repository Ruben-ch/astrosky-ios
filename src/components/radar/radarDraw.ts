/**
 * Rendu Canvas 2D du radar orbital polaire (zénith au centre, horizon au bord,
 * nord en haut, est à droite) : graduations d'instrument, balayage, satellites
 * levés (taille selon la magnitude), trajectoire du passage sélectionné
 * (visible / ombre / jour) et évènements. Fonction pure, palette injectée.
 */
import type { RenderPalette } from '../../theme/palette'
import type { PassEvent, VisiblePass } from '../../types/orbital'

const DEG = Math.PI / 180

export interface LiveBlip {
  readonly noradId: number
  readonly name: string
  readonly azimuthDeg: number
  readonly elevationDeg: number
  readonly sunlit: boolean
  readonly magnitude: number | null
}

export interface RadarScene {
  readonly blips: readonly LiveBlip[]
  readonly pass: VisiblePass | null
  readonly selectedId: number | null
  /** Position courante du satellite sélectionné (propagée à chaque image). */
  readonly selectedPos: { azimuthDeg: number; elevationDeg: number } | null
  /** Angle du balayage décoratif, en radians. */
  readonly sweepRad: number
}

export interface RadarGeometry {
  readonly cx: number
  readonly cy: number
  readonly r: number
}

export function radarGeometry(width: number, height: number): RadarGeometry {
  return { cx: width / 2, cy: height / 2, r: Math.min(width, height) / 2 - 22 }
}

/** Coordonnées écran d'une direction (azimut, hauteur). */
export function radarXY(g: RadarGeometry, azDeg: number, elDeg: number): [number, number] {
  const rr = ((90 - Math.max(0, Math.min(90, elDeg))) / 90) * g.r
  return [g.cx + rr * Math.sin(azDeg * DEG), g.cy - rr * Math.cos(azDeg * DEG)]
}

/** Rayon d'un satellite selon sa magnitude (plus brillant = plus gros). */
export const blipRadius = (mag: number | null) => (mag === null ? 2 : Math.max(2, Math.min(6, 4.2 - mag * 0.7)))

function drawScope(ctx: CanvasRenderingContext2D, g: RadarGeometry, p: RenderPalette, sweepRad: number) {
  const { cx, cy, r } = g
  ctx.fillStyle = p.orbital.scope
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Balayage : secteur dégradé de 40° derrière la ligne (gradient conique : iOS ≥ 16.4).
  if (typeof ctx.createConicGradient === 'function') {
    const sweep = ctx.createConicGradient(sweepRad - Math.PI / 2 - 0.7, cx, cy)
    sweep.addColorStop(0, 'rgba(0, 0, 0, 0)')
    sweep.addColorStop(0.11, p.orbital.sweep)
    sweep.addColorStop(0.111, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = sweep
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const el of [0, 15, 30, 45, 60, 75]) {
    ctx.strokeStyle = el === 0 ? p.gridStrong : el % 30 === 0 ? p.gridStrong : p.grid
    ctx.lineWidth = el === 0 ? 1.2 : 0.6
    ctx.setLineDash(el % 30 === 0 ? [] : [2, 3])
    ctx.beginPath()
    ctx.arc(cx, cy, ((90 - el) / 90) * r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  for (let az = 0; az < 360; az += 5) {
    const len = az % 90 === 0 ? 12 : az % 30 === 0 ? 8 : az % 10 === 0 ? 5 : 3
    ctx.strokeStyle = az % 30 === 0 ? p.gridStrong : p.grid
    ctx.lineWidth = az % 30 === 0 ? 1 : 0.6
    const s = Math.sin(az * DEG)
    const c = Math.cos(az * DEG)
    ctx.beginPath()
    ctx.moveTo(cx + r * s, cy - r * c)
    ctx.lineTo(cx + (r - len) * s, cy - (r - len) * c)
    ctx.stroke()
  }
  ctx.strokeStyle = p.grid
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (let az = 0; az < 180; az += 30) {
    const s = Math.sin(az * DEG)
    const c = Math.cos(az * DEG)
    ctx.moveTo(cx - r * s, cy + r * c)
    ctx.lineTo(cx + r * s, cy - r * c)
  }
  ctx.stroke()

  ctx.font = '600 11px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['O', 270]] as const) {
    ctx.fillStyle = az === 0 ? p.accent : p.textDim
    ctx.fillText(label, cx + (r + 12) * Math.sin(az * DEG), cy - (r + 12) * Math.cos(az * DEG))
  }
  ctx.font = '500 9px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = p.textDim
  for (const el of [30, 60]) ctx.fillText(`${el}°`, cx + 4, cy - ((90 - el) / 90) * r + 7)
}

function marker(ctx: CanvasRenderingContext2D, g: RadarGeometry, ev: PassEvent, kind: 'rise' | 'set' | 'culm' | 'shadow', p: RenderPalette, label?: string) {
  const [x, y] = radarXY(g, ev.azimuthDeg, ev.elevationDeg)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = kind === 'shadow' ? p.orbital.shadowEvent : kind === 'culm' ? p.orbital.trackVisible : p.orbital.event
  ctx.fillStyle = ctx.strokeStyle
  ctx.beginPath()
  if (kind === 'culm') {
    ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6)
    ctx.stroke()
  } else if (kind === 'shadow') {
    ctx.arc(x, y, 4.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 4.5, -Math.PI / 2, Math.PI / 2)
    ctx.fill()
  } else {
    const dir = kind === 'rise' ? -1 : 1
    ctx.moveTo(x, y + dir * 5); ctx.lineTo(x - 4.5, y - dir * 3); ctx.lineTo(x + 4.5, y - dir * 3)
    ctx.closePath()
    ctx.fill()
  }
  if (label) {
    ctx.font = '600 10px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = p.orbital.label
    ctx.fillText(label, Math.max(g.cx - g.r + 20, Math.min(g.cx + g.r - 20, x)), y - 8)
  }
}

function drawPass(ctx: CanvasRenderingContext2D, g: RadarGeometry, pass: VisiblePass, p: RenderPalette) {
  const tr = pass.track
  ctx.lineCap = 'round'
  for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1]
    const b = tr[i]
    const style = b.visible ? 'visible' : b.sunlit ? 'day' : 'shadow'
    ctx.strokeStyle = style === 'visible' ? p.orbital.trackVisible : style === 'shadow' ? p.orbital.trackShadow : p.orbital.trackDay
    ctx.lineWidth = style === 'visible' ? 2.8 : 1.3
    ctx.setLineDash(style === 'visible' ? [] : style === 'shadow' ? [4, 4] : [1, 4])
    const [x0, y0] = radarXY(g, a.azimuthDeg, a.elevationDeg)
    const [x1, y1] = radarXY(g, b.azimuthDeg, b.elevationDeg)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.setLineDash([])
  marker(ctx, g, pass.rise, 'rise', p)
  marker(ctx, g, pass.set, 'set', p)
  if (pass.shadowEntry) marker(ctx, g, pass.shadowEntry, 'shadow', p)
  if (pass.shadowExit) marker(ctx, g, pass.shadowExit, 'shadow', p)
  const c = pass.culmination
  const mag = c.magnitude !== null ? ` · mag ${c.magnitude < 0 ? '−' : ''}${Math.abs(c.magnitude).toFixed(1).replace('.', ',')}` : ''
  marker(ctx, g, c, 'culm', p, `${Math.round(c.elevationDeg)}°${mag}`)
}

export function drawRadar(ctx: CanvasRenderingContext2D, width: number, height: number, scene: RadarScene, p: RenderPalette): void {
  const g = radarGeometry(width, height)
  drawScope(ctx, g, p, scene.sweepRad)
  if (scene.pass) drawPass(ctx, g, scene.pass, p)

  ctx.font = '500 9px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const b of scene.blips) {
    if (b.elevationDeg <= 0 || b.noradId === scene.selectedId) continue
    const [x, y] = radarXY(g, b.azimuthDeg, b.elevationDeg)
    ctx.fillStyle = b.sunlit ? p.orbital.satLit : p.orbital.satShadow
    ctx.beginPath()
    ctx.arc(x, y, b.sunlit ? blipRadius(b.magnitude) : 2, 0, Math.PI * 2)
    ctx.fill()
    if (b.sunlit && b.magnitude !== null && b.magnitude < 1.5) {
      ctx.fillStyle = p.orbital.label
      ctx.fillText(b.name, x + 7, y)
    }
  }

  const s = scene.selectedPos
  if (s && s.elevationDeg > 0) {
    const [x, y] = radarXY(g, s.azimuthDeg, s.elevationDeg)
    ctx.fillStyle = p.orbital.selected
    ctx.strokeStyle = p.orbital.selected
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 10 + 2 * Math.sin(scene.sweepRad * 3), 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** Satellite levé le plus proche d'un toucher (rayon 26 px), ou `null`. */
export function pickBlip(width: number, height: number, blips: readonly LiveBlip[], x: number, y: number): LiveBlip | null {
  const g = radarGeometry(width, height)
  let best: LiveBlip | null = null
  let bestD = 26
  for (const b of blips) {
    if (b.elevationDeg <= 0) continue
    const [bx, by] = radarXY(g, b.azimuthDeg, b.elevationDeg)
    const d = Math.hypot(bx - x, by - y)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}
