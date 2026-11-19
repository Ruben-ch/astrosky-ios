/**
 * Horloge de simulation pure (sans React) : le temps simulé est une fonction
 * affine du temps réel, définie par une ancre `{ realMs, simMs, rate }`.
 *   simNow = simMs + (realNow − realMs) × rate
 * Chaque modification (vitesse, saut) ré-ancre l'horloge pour rester continue.
 */
import type { ClockAnchor } from '../types/services'

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000

/** Vitesses proposées dans l'interface (facteur multiplicateur du temps réel). */
export const SIMULATION_RATES = [-3600, -600, -60, 0, 1, 60, 600, 3600, 86_400] as const

/** Bornes de voyage dans le temps (validité des théories VSOP87/ELP d'astronomy-engine). */
export const MIN_SIM_MS = Date.UTC(1600, 0, 1)
export const MAX_SIM_MS = Date.UTC(2400, 0, 1)

export function createAnchor(realMs: number, simMs: number = realMs, rate = 1): ClockAnchor {
  return { realMs, simMs: clampSim(simMs), rate }
}

export function clampSim(simMs: number): number {
  return Math.min(MAX_SIM_MS, Math.max(MIN_SIM_MS, simMs))
}

/** Temps simulé (ms) à l'instant réel donné. */
export function simTimeAt(anchor: ClockAnchor, realMs: number): number {
  return clampSim(anchor.simMs + (realMs - anchor.realMs) * anchor.rate)
}

/** Change la vitesse sans discontinuité du temps simulé. */
export function withRate(anchor: ClockAnchor, rate: number, realMs: number): ClockAnchor {
  return { realMs, simMs: simTimeAt(anchor, realMs), rate }
}

/** Décale le temps simulé de `deltaMs` (positif = futur). */
export function shiftBy(anchor: ClockAnchor, deltaMs: number, realMs: number): ClockAnchor {
  return { realMs, simMs: clampSim(simTimeAt(anchor, realMs) + deltaMs), rate: anchor.rate }
}

/** Saute à une date absolue en conservant la vitesse courante. */
export function jumpTo(anchor: ClockAnchor, simMs: number, realMs: number): ClockAnchor {
  return { realMs, simMs: clampSim(simMs), rate: anchor.rate }
}

/** Retour au temps réel à vitesse 1×. */
export function resetToNow(realMs: number): ClockAnchor {
  return createAnchor(realMs, realMs, 1)
}

/** L'horloge suit-elle le temps réel (vitesse 1× et écart < 1 s) ? */
export function isLive(anchor: ClockAnchor, realMs: number): boolean {
  return anchor.rate === 1 && Math.abs(simTimeAt(anchor, realMs) - realMs) < 1000
}

/** Écart signé entre temps simulé et réel, en millisecondes. */
export function offsetFromReal(anchor: ClockAnchor, realMs: number): number {
  return simTimeAt(anchor, realMs) - realMs
}

export type CalendarUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/** Unités de pas proposées par la machine temporelle. */
export const CALENDAR_UNITS: readonly CalendarUnit[] = ['minute', 'hour', 'day', 'week', 'month', 'year']

const FIXED_UNIT_MS: Partial<Record<CalendarUnit, number>> = {
  minute: MS_PER_MINUTE,
  hour: MS_PER_HOUR,
  day: MS_PER_DAY,
  week: 7 * MS_PER_DAY,
}

/**
 * Décale `simMs` de `count` unités. Jours et semaines sont des durées fixes
 * (le temps sidéral avance régulièrement) ; mois et années suivent le
 * calendrier local en conservant l'heure murale, le jour étant borné à la fin
 * du mois cible (31 janv. + 1 mois → 28/29 févr.).
 */
export function shiftCalendar(simMs: number, unit: CalendarUnit, count: number): number {
  const fixed = FIXED_UNIT_MS[unit]
  if (fixed !== undefined) return clampSim(simMs + count * fixed)
  const d = new Date(simMs)
  const months = unit === 'year' ? count * 12 : count
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return clampSim(d.getTime())
}

/** Formate un écart (« +2 j 03 h 15 min », « −45 min »). */
export function formatOffset(offsetMs: number): string {
  const sign = offsetMs < 0 ? '−' : '+'
  let rest = Math.round(Math.abs(offsetMs) / MS_PER_MINUTE)
  const days = Math.floor(rest / 1440)
  rest -= days * 1440
  const hours = Math.floor(rest / 60)
  const minutes = rest - hours * 60
  if (days > 0) return `${sign}${days} j ${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min`
  if (hours > 0) return `${sign}${hours} h ${String(minutes).padStart(2, '0')} min`
  return `${sign}${minutes} min`
}

/** Libellé court d'une vitesse (« 1× », « 1 min/s », « −1 h/s », « 1 j/s », « Pause »). */
export function formatRate(rate: number): string {
  if (rate === 0) return 'Pause'
  if (rate === 1) return '1×'
  const sign = rate < 0 ? '−' : ''
  const abs = Math.abs(rate)
  if (abs >= 86_400) return `${sign}${abs / 86_400} j/s`
  if (abs >= 3600) return `${sign}${abs / 3600} h/s`
  if (abs >= 60) return `${sign}${abs / 60} min/s`
  return `${sign}${abs}×`
}
