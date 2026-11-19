/**
 * Calendrier des phénomènes célestes à venir : phases, éclipses, élongations,
 * oppositions, conjonctions, éclat maximal de Vénus, saisons, apsides lunaires
 * et maxima d'essaims météoritiques.
 */
import {
  ApsisKind,
  Body,
  NextLunarApsis,
  NextLunarEclipse,
  NextLocalSolarEclipse,
  SearchLocalSolarEclipse,
  SearchLunarApsis,
  SearchLunarEclipse,
  SearchMaxElongation,
  SearchPeakMagnitude,
  SearchRelativeLongitude,
  Seasons,
} from 'astronomy-engine'
import type { AstroEvent, ObserverLocation, SolarSystemBodyId } from '../../types/astro'
import { METEOR_SHOWERS } from '../../data/meteorShowers'
import { BODY_NAME_FR, toObserver } from './bodies'
import { nextShowerPeak } from './meteors'
import { nextMoonQuarters, QUARTER_FR } from './moon'

const MS_PER_DAY = 86_400_000

/** Nombre décimal au format français (virgule, vrai signe moins). */
const fr = (x: number, digits: number) =>
  x.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−')

const ECLIPSE_KIND_FR: Record<string, string> = {
  penumbral: 'pénombrale', partial: 'partielle', annular: 'annulaire', total: 'totale',
}

function inRange(t: Date, start: Date, end: Date): boolean {
  return t >= start && t <= end
}

function ev(kind: AstroEvent['kind'], time: Date, title: string, detail: string, bodies: SolarSystemBodyId[] = []): AstroEvent {
  return { kind, time, title, detail, bodies }
}

function moonPhaseEvents(start: Date, end: Date): AstroEvent[] {
  const count = Math.ceil((end.getTime() - start.getTime()) / (7 * MS_PER_DAY)) + 2
  return nextMoonQuarters(start, count)
    .filter((q) => inRange(q.time, start, end))
    .map((q) => ev('moon-phase', q.time, QUARTER_FR[q.quarter], 'Phase principale de la Lune', ['Moon']))
}

function eclipseEvents(start: Date, end: Date, loc: ObserverLocation): AstroEvent[] {
  const out: AstroEvent[] = []
  for (let e = SearchLunarEclipse(start); e.peak.date <= end; e = NextLunarEclipse(e.peak)) {
    out.push(ev('lunar-eclipse', e.peak.date, `Éclipse ${ECLIPSE_KIND_FR[e.kind]} de Lune`,
      `Obscuration ${fr(e.obscuration * 100, 0)} % · durée pénombrale ${fr(e.sd_penum * 2, 0)} min`, ['Moon']))
  }
  const observer = toObserver(loc)
  for (let s = SearchLocalSolarEclipse(start, observer); s.peak.time.date <= end; s = NextLocalSolarEclipse(s.peak.time, observer)) {
    if (s.peak.altitude <= 0) continue
    out.push(ev('solar-eclipse', s.peak.time.date, `Éclipse ${ECLIPSE_KIND_FR[s.kind]} de Soleil`,
      `Obscuration ${fr(s.obscuration * 100, 1)} % · Soleil à ${fr(s.peak.altitude, 0)}° au maximum`, ['Sun', 'Moon']))
  }
  return out
}

function planetEvents(start: Date, end: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (const id of ['Mercury', 'Venus'] as const) {
    for (let t = start; ;) {
      const e = SearchMaxElongation(Body[id], t)
      if (e.time.date > end) break
      const when = e.visibility === 'morning' ? 'à l\'aube (est)' : 'au crépuscule (ouest)'
      out.push(ev('max-elongation', e.time.date, `${BODY_NAME_FR[id]} à son élongation maximale`,
        `${fr(e.elongation, 1)}° du Soleil, visible ${when}`, [id]))
      t = new Date(e.time.date.getTime() + MS_PER_DAY)
    }
    for (const [relLon, label] of [[0, 'inférieure'], [180, 'supérieure']] as const) {
      const t = SearchRelativeLongitude(Body[id], relLon, start)
      if (t.date <= end) out.push(ev('conjunction', t.date, `Conjonction ${label} de ${BODY_NAME_FR[id]}`, 'Planète noyée dans l\'éclat solaire', [id]))
    }
  }
  for (const id of ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const) {
    const opp = SearchRelativeLongitude(Body[id], 0, start)
    if (opp.date <= end) out.push(ev('opposition', opp.date, `Opposition de ${BODY_NAME_FR[id]}`, 'Visible toute la nuit, éclat et taille maximaux', [id]))
    const conj = SearchRelativeLongitude(Body[id], 180, start)
    if (conj.date <= end) out.push(ev('conjunction', conj.date, `Conjonction de ${BODY_NAME_FR[id]} avec le Soleil`, 'Planète inobservable', [id]))
  }
  const venusPeak = SearchPeakMagnitude(Body.Venus, start)
  if (venusPeak.time.date <= end) {
    out.push(ev('peak-magnitude', venusPeak.time.date, 'Vénus à son éclat maximal', `Magnitude ${fr(venusPeak.mag, 2)}`, ['Venus']))
  }
  return out
}

function seasonEvents(start: Date, end: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    const s = Seasons(y)
    const list: [Date, string][] = [
      [s.mar_equinox.date, 'Équinoxe de mars'], [s.jun_solstice.date, 'Solstice de juin'],
      [s.sep_equinox.date, 'Équinoxe de septembre'], [s.dec_solstice.date, 'Solstice de décembre'],
    ]
    for (const [t, title] of list) if (inRange(t, start, end)) out.push(ev('season', t, title, 'Changement de saison', ['Sun']))
  }
  return out
}

function apsisEvents(start: Date, end: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (let a = SearchLunarApsis(start); a.time.date <= end; a = NextLunarApsis(a)) {
    const title = a.kind === ApsisKind.Pericenter ? 'Lune au périgée' : 'Lune à l\'apogée'
    out.push(ev('lunar-apsis', a.time.date, title, `${Math.round(a.dist_km).toLocaleString('fr-FR')} km`, ['Moon']))
  }
  return out
}

function meteorEvents(start: Date, end: Date): AstroEvent[] {
  return METEOR_SHOWERS.filter((s) => s.zhr >= 10 || !s.variable)
    .map((s) => ({ s, peak: nextShowerPeak(s, new Date(start.getTime() - MS_PER_DAY)) }))
    .filter(({ peak }) => inRange(peak, start, end))
    .map(({ s, peak }) => ev('meteor-shower', peak, `Maximum des ${s.name}`,
      `ZHR ${s.zhr} · ${s.velocityKmS} km/s · ${s.parentBody}`))
}

/** Tous les phénomènes entre `start` et `start + days`, triés chronologiquement. */
export function getUpcomingEvents(start: Date, days: number, loc: ObserverLocation): AstroEvent[] {
  const end = new Date(start.getTime() + days * MS_PER_DAY)
  return [
    ...moonPhaseEvents(start, end),
    ...eclipseEvents(start, end, loc),
    ...planetEvents(start, end),
    ...seasonEvents(start, end),
    ...apsisEvents(start, end),
    ...meteorEvents(start, end),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())
}
