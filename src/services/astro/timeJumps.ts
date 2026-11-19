/**
 * Sauts temporels de la machine à voyager dans le temps : prochain coucher,
 * début de nuit noire, minuit solaire, aube, lever, lever/coucher de Lune,
 * nouvelle et pleine lune. Tous les instants viennent d'astronomy-engine.
 */
import { Body, SearchAltitude, SearchHourAngle, SearchMoonPhase, SearchRiseSet } from 'astronomy-engine'
import type { ObserverLocation } from '../../types/astro'
import { toObserver } from './bodies'
import { TWILIGHT_ALTITUDE_DEG } from './riseSet'

export type TimeJumpId =
  | 'sunset'
  | 'astro-dusk'
  | 'solar-midnight'
  | 'astro-dawn'
  | 'sunrise'
  | 'moonrise'
  | 'moonset'
  | 'new-moon'
  | 'full-moon'

export interface TimeJump {
  readonly id: TimeJumpId
  readonly label: string
  readonly time: Date
}

export const TIME_JUMP_LABEL_FR: Readonly<Record<TimeJumpId, string>> = {
  sunset: 'Coucher',
  'astro-dusk': 'Nuit noire',
  'solar-midnight': 'Minuit solaire',
  'astro-dawn': 'Aube astro',
  sunrise: 'Lever',
  moonrise: 'Lever Lune',
  moonset: 'Coucher Lune',
  'new-moon': 'Nouvelle lune',
  'full-moon': 'Pleine lune',
}

/** Marge pour qu'un second appui après un saut vise l'occurrence suivante. */
const EPSILON_MS = 60_000
const DAYS_SUN = 2
const DAYS_MOON_PHASE = 35

/** Prochains évènements après `date`, triés chronologiquement (absents omis : nuit polaire…). */
export function getTimeJumps(date: Date, loc: ObserverLocation): TimeJump[] {
  const observer = toObserver(loc)
  const from = new Date(date.getTime() + EPSILON_MS)
  const raw: [TimeJumpId, Date | null | undefined][] = [
    ['sunset', SearchRiseSet(Body.Sun, observer, -1, from, DAYS_SUN)?.date],
    ['astro-dusk', SearchAltitude(Body.Sun, observer, -1, from, DAYS_SUN, TWILIGHT_ALTITUDE_DEG.astronomical)?.date],
    ['solar-midnight', SearchHourAngle(Body.Sun, observer, 12, from, +1).time.date],
    ['astro-dawn', SearchAltitude(Body.Sun, observer, +1, from, DAYS_SUN, TWILIGHT_ALTITUDE_DEG.astronomical)?.date],
    ['sunrise', SearchRiseSet(Body.Sun, observer, +1, from, DAYS_SUN)?.date],
    ['moonrise', SearchRiseSet(Body.Moon, observer, +1, from, DAYS_SUN)?.date],
    ['moonset', SearchRiseSet(Body.Moon, observer, -1, from, DAYS_SUN)?.date],
    ['new-moon', SearchMoonPhase(0, from, DAYS_MOON_PHASE)?.date],
    ['full-moon', SearchMoonPhase(180, from, DAYS_MOON_PHASE)?.date],
  ]
  return raw
    .filter((r): r is [TimeJumpId, Date] => r[1] instanceof Date)
    .map(([id, time]) => ({ id, label: TIME_JUMP_LABEL_FR[id], time }))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
}
