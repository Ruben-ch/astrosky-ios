/**
 * Dessin Canvas 2D de la frise de nuit : bandes crépusculaires, graduations
 * horaires, présence lunaire, nuit noire sans Lune et curseur temps.
 * Fonction pure (palette injectée) : aucune couleur codée en dur.
 */
import type { RenderPalette } from '../../theme/palette'
import type { NightTimeline, TwilightPhase } from '../../types/tonight'

export const TIMELINE_LAYOUT = { axisH: 14, bandTop: 16, bandH: 34, laneGap: 6, laneH: 5, padX: 2 } as const
export const TIMELINE_HEIGHT = 16 + 34 + 6 + 5 + 6 + 5 + 4

const PHASE_INDEX: Record<TwilightPhase, 0 | 1 | 2 | 3 | 4> = { day: 0, civil: 1, nautical: 2, astronomical: 3, night: 4 }

/** Fenêtre affichée : 1 h avant la première transition → 1 h après la dernière. */
export function visibleRange(tl: NightTimeline): { t0: number; t1: number } {
  if (tl.transitions.length === 0) return { t0: tl.start.getTime(), t1: tl.end.getTime() }
  const HOUR = 3_600_000
  const first = tl.transitions[0].time.getTime()
  const last = tl.transitions[tl.transitions.length - 1].time.getTime()
  return { t0: Math.max(tl.start.getTime(), first - HOUR), t1: Math.min(tl.end.getTime(), last + HOUR) }
}

export function drawTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  tl: NightTimeline,
  nowMs: number,
  p: RenderPalette,
): void {
  const L = TIMELINE_LAYOUT
  const { t0, t1 } = visibleRange(tl)
  const plotW = width - 2 * L.padX
  const x = (t: number) => L.padX + ((t - t0) / (t1 - t0)) * plotW
  const clampX = (t: number) => x(Math.min(t1, Math.max(t0, t)))

  // Bandes de phase.
  for (const s of tl.segments) {
    const xa = clampX(s.start.getTime())
    const xb = clampX(s.end.getTime())
    if (xb <= xa) continue
    ctx.fillStyle = p.twilight[PHASE_INDEX[s.phase]]
    ctx.fillRect(xa, L.bandTop, xb - xa + 0.5, L.bandH)
  }
  ctx.strokeStyle = p.gridStrong
  ctx.lineWidth = 1
  ctx.strokeRect(L.padX + 0.5, L.bandTop + 0.5, plotW - 1, L.bandH - 1)

  // Transitions : filets fins.
  ctx.strokeStyle = p.gridStrong
  ctx.lineWidth = 0.75
  for (const tr of tl.transitions) {
    const xx = Math.round(x(tr.time.getTime())) + 0.5
    ctx.beginPath()
    ctx.moveTo(xx, L.bandTop)
    ctx.lineTo(xx, L.bandTop + L.bandH)
    ctx.stroke()
  }

  // Graduations horaires (heures locales) et étiquettes toutes les 3 h.
  ctx.font = '500 9px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const HOUR = 3_600_000
  for (let t = Math.ceil(t0 / HOUR) * HOUR; t <= t1; t += HOUR) {
    const hour = new Date(t).getHours()
    const xx = Math.round(x(t)) + 0.5
    ctx.strokeStyle = p.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    // Graduation externe (au-dessus de la bande) : la bande reste réservée aux transitions.
    ctx.moveTo(xx, L.bandTop - (hour % 3 === 0 ? 4 : 2))
    ctx.lineTo(xx, L.bandTop)
    ctx.stroke()
    if (hour % 3 === 0 && xx > 10 && xx < width - 10) {
      ctx.fillStyle = p.textDim
      ctx.fillText(`${String(hour).padStart(2, '0')}h`, xx, 0)
    }
  }

  // Couloirs : Lune levée, puis nuit noire sans Lune.
  const lane = (top: number, color: string, list: readonly { start: Date; end: Date }[]) => {
    ctx.fillStyle = p.grid
    ctx.fillRect(L.padX, top, plotW, L.laneH)
    ctx.fillStyle = color
    for (const i of list) {
      const xa = clampX(i.start.getTime())
      const xb = clampX(i.end.getTime())
      if (xb > xa) ctx.fillRect(xa, top, Math.max(1, xb - xa), L.laneH)
    }
  }
  const moonTop = L.bandTop + L.bandH + L.laneGap
  lane(moonTop, p.chart.moonUp, tl.moonUp)
  lane(moonTop + L.laneH + L.laneGap, p.chart.moonlessDark, tl.moonlessDark)

  // Curseur du temps simulé.
  if (nowMs >= t0 && nowMs <= t1) {
    const xn = Math.round(x(nowMs)) + 0.5
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(xn, L.bandTop - 2)
    ctx.lineTo(xn, TIMELINE_HEIGHT - 2)
    ctx.stroke()
    ctx.fillStyle = p.accent
    ctx.beginPath()
    ctx.arc(xn, L.bandTop - 2, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Instant (ms) correspondant à l'abscisse CSS `px` sur la frise. */
export function timeAtX(px: number, width: number, tl: NightTimeline): number {
  const { t0, t1 } = visibleRange(tl)
  const ratio = (px - TIMELINE_LAYOUT.padX) / (width - 2 * TIMELINE_LAYOUT.padX)
  return t0 + Math.min(1, Math.max(0, ratio)) * (t1 - t0)
}
