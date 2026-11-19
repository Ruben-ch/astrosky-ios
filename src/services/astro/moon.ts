/** Phase, âge, distance et prochaines lunaisons de la Lune. */
import {
  Body,
  GeoMoon,
  Illumination,
  KM_PER_AU,
  MoonPhase,
  NextMoonQuarter,
  SearchMoonPhase,
  SearchMoonQuarter,
} from 'astronomy-engine'
import type { MoonInfo, MoonPhaseEvent, MoonPhaseName } from '../../types/astro'

const MS_PER_DAY = 86_400_000

export const MOON_PHASE_FR: Readonly<Record<MoonPhaseName, string>> = {
  new: 'Nouvelle lune',
  'waxing-crescent': 'Premier croissant',
  'first-quarter': 'Premier quartier',
  'waxing-gibbous': 'Gibbeuse croissante',
  full: 'Pleine lune',
  'waning-gibbous': 'Gibbeuse décroissante',
  'third-quarter': 'Dernier quartier',
  'waning-crescent': 'Dernier croissant',
}

export const QUARTER_FR = ['Nouvelle lune', 'Premier quartier', 'Pleine lune', 'Dernier quartier'] as const

/** Demi-largeur (°) des phases principales : ±7,5° ≈ ±14 h autour de l'instant exact. */
const PRINCIPAL_HALF_WIDTH_DEG = 7.5

/** Nom de phase à partir de l'angle de phase (longitude Lune − Soleil) en degrés. */
export function phaseNameFromAngle(phaseAngleDeg: number): MoonPhaseName {
  const a = ((phaseAngleDeg % 360) + 360) % 360
  const near = (center: number) => Math.abs(((a - center + 540) % 360) - 180) <= PRINCIPAL_HALF_WIDTH_DEG
  if (near(0)) return 'new'
  if (near(90)) return 'first-quarter'
  if (near(180)) return 'full'
  if (near(270)) return 'third-quarter'
  if (a < 90) return 'waxing-crescent'
  if (a < 180) return 'waxing-gibbous'
  if (a < 270) return 'waning-gibbous'
  return 'waning-crescent'
}

/** Instant de la dernière nouvelle lune précédant `date`. */
export function previousNewMoon(date: Date): Date {
  let t = SearchMoonPhase(0, new Date(date.getTime() - 31 * MS_PER_DAY), 31)
  if (!t) throw new Error('Nouvelle lune introuvable')
  for (;;) {
    const next = SearchMoonPhase(0, new Date(t.date.getTime() + MS_PER_DAY), 31)
    if (!next || next.date > date) return t.date
    t = next
  }
}

/** Les `count` prochaines phases principales après `date`. */
export function nextMoonQuarters(date: Date, count = 4): MoonPhaseEvent[] {
  const out: MoonPhaseEvent[] = []
  let mq = SearchMoonQuarter(date)
  for (let i = 0; i < count; i++) {
    out.push({ quarter: mq.quarter as 0 | 1 | 2 | 3, time: mq.time.date })
    mq = NextMoonQuarter(mq)
  }
  return out
}

export function getMoonInfo(date: Date): MoonInfo {
  const phaseAngleDeg = MoonPhase(date)
  const phaseName = phaseNameFromAngle(phaseAngleDeg)
  return {
    phaseAngleDeg,
    phaseName,
    phaseNameFr: MOON_PHASE_FR[phaseName],
    illuminatedFraction: Illumination(Body.Moon, date).phase_fraction,
    ageDays: (date.getTime() - previousNewMoon(date).getTime()) / MS_PER_DAY,
    distanceKm: GeoMoon(date).Length() * KM_PER_AU,
    nextQuarters: nextMoonQuarters(date, 4),
  }
}
