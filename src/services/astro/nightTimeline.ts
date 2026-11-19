/**
 * Frise chronologique de la nuit d'observation (midi solaire → midi solaire) :
 * phases crépusculaires, présence de la Lune et fenêtres de nuit noire sans Lune.
 * Instants exacts issus d'astronomy-engine (SearchAltitude / SearchRiseSet).
 */
import { Body, SearchHourAngle, SearchRiseSet } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import type { Interval, NightTimeline, TwilightPhase, TwilightSegment, TwilightTransition } from '../../types/tonight'
import { getBodyHorizontal, getSunGeometricAltitudeDeg, toObserver } from './bodies'
import { TWILIGHT_ALTITUDE_DEG, getTwilightTimes, observingNightStart } from './riseSet'

const MS_PER_DAY = 86_400_000

export const TWILIGHT_PHASE_FR: Readonly<Record<TwilightPhase, string>> = {
  day: 'Jour',
  civil: 'Crépuscule civil',
  nautical: 'Crépuscule nautique',
  astronomical: 'Crépuscule astronomique',
  night: 'Nuit noire',
}

/** Phase lumineuse pour une hauteur **géométrique** du centre du Soleil (degrés, cf. `getSunGeometricAltitudeDeg`). */
export function phaseForSunAltitude(sunAltitudeDeg: number): TwilightPhase {
  if (sunAltitudeDeg > -0.833) return 'day'
  if (sunAltitudeDeg > TWILIGHT_ALTITUDE_DEG.civil) return 'civil'
  if (sunAltitudeDeg > TWILIGHT_ALTITUDE_DEG.nautical) return 'nautical'
  if (sunAltitudeDeg > TWILIGHT_ALTITUDE_DEG.astronomical) return 'astronomical'
  return 'night'
}

/** Intervalles où la Lune est levée dans [start, end]. */
export function moonUpIntervals(start: Date, end: Date, loc: ObserverLocation): Interval[] {
  const observer = toObserver(loc)
  const events: { time: Date; up: boolean }[] = []
  for (const direction of [+1, -1] as const) {
    let t = start
    for (;;) {
      const limitDays = (end.getTime() - t.getTime()) / MS_PER_DAY
      if (limitDays <= 0) break
      const ev = SearchRiseSet(Body.Moon, observer, direction, t, limitDays)
      if (!ev || ev.date > end) break
      events.push({ time: ev.date, up: direction === +1 })
      t = new Date(ev.date.getTime() + 60_000)
    }
  }
  events.sort((a, b) => a.time.getTime() - b.time.getTime())
  // État initial : déduit du premier évènement (un coucher ⇒ Lune levée), sinon de la hauteur.
  let up = events.length > 0 ? !events[0].up : getBodyHorizontal('Moon', start, loc).altitudeDeg > 0
  const out: Interval[] = []
  let openedAt: Date | null = up ? start : null
  for (const ev of events) {
    if (ev.up && !up) openedAt = ev.time
    if (!ev.up && up && openedAt) out.push({ start: openedAt, end: ev.time })
    up = ev.up
  }
  if (up && openedAt) out.push({ start: openedAt, end })
  return out
}

/** Soustrait `minus` (intervalles triés) à chacun des intervalles `base`. */
export function subtractIntervals(base: readonly Interval[], minus: readonly Interval[]): Interval[] {
  const out: Interval[] = []
  for (const b of base) {
    let cursor = b.start.getTime()
    const end = b.end.getTime()
    for (const m of minus) {
      const ms = m.start.getTime()
      const me = m.end.getTime()
      if (me <= cursor || ms >= end) continue
      if (ms > cursor) out.push({ start: new Date(cursor), end: new Date(ms) })
      cursor = Math.max(cursor, me)
    }
    if (cursor < end) out.push({ start: new Date(cursor), end: b.end })
  }
  return out
}

export const intervalMinutes = (list: readonly Interval[]) =>
  list.reduce((sum, i) => sum + (i.end.getTime() - i.start.getTime()) / 60_000, 0)

/** Construit la frise complète de la nuit d'observation contenant `date`. */
export function getNightTimeline(date: Date, loc: ObserverLocation): NightTimeline {
  const start = observingNightStart(date, loc)
  // Midi solaire suivant : borne exacte (la durée du jour solaire varie de ±30 s).
  const end = SearchHourAngle(Body.Sun, toObserver(loc), 0, new Date(start.getTime() + 3_600_000), +1).time.date
  const t = getTwilightTimes(date, loc)
  const candidates: (Omit<TwilightTransition, 'time'> & { time: Date | null })[] = [
    { time: t.sunset, phase: 'civil', label: 'Coucher du Soleil', evening: true },
    { time: t.civilDusk, phase: 'nautical', label: 'Fin du crépuscule civil', evening: true },
    { time: t.nauticalDusk, phase: 'astronomical', label: 'Fin du crépuscule nautique', evening: true },
    { time: t.astronomicalDusk, phase: 'night', label: 'Début de la nuit noire', evening: true },
    { time: t.astronomicalDawn, phase: 'astronomical', label: "Aube astronomique", evening: false },
    { time: t.nauticalDawn, phase: 'nautical', label: 'Aube nautique', evening: false },
    { time: t.civilDawn, phase: 'civil', label: 'Aube civile', evening: false },
    { time: t.sunrise, phase: 'day', label: 'Lever du Soleil', evening: false },
  ]
  const transitions = candidates
    .filter((c): c is TwilightTransition => c.time !== null && c.time > start && c.time < end)
    .sort((a, b) => a.time.getTime() - b.time.getTime())

  const segments: TwilightSegment[] = []
  let phase = phaseForSunAltitude(getSunGeometricAltitudeDeg(start, loc))
  let cursor = start
  for (const tr of transitions) {
    if (tr.phase === phase) continue
    segments.push({ phase, start: cursor, end: tr.time })
    phase = tr.phase
    cursor = tr.time
  }
  segments.push({ phase, start: cursor, end })

  const moonUp = moonUpIntervals(start, end, loc)
  const dark = segments.filter((s) => s.phase === 'night').map((s) => ({ start: s.start, end: s.end }))
  const moonlessDark = subtractIntervals(dark, moonUp)
  return { start, end, segments, transitions, moonUp, moonlessDark, moonlessDarkMinutes: intervalMinutes(moonlessDark) }
}

/** Segment contenant l'instant `time`, ou `null` hors frise. */
export function segmentAt(timeline: NightTimeline, time: Date): TwilightSegment | null {
  return timeline.segments.find((s) => time >= s.start && time < s.end) ?? null
}

/** Prochaine transition strictement après `time`, ou `null`. */
export function nextTransition(timeline: NightTimeline, time: Date): TwilightTransition | null {
  return timeline.transitions.find((tr) => tr.time > time) ?? null
}
