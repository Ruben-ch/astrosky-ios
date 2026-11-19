/**
 * Suivi orbital ISS / satellites par SGP4 (satellite.js) :
 * position instantanée, visibilité à l'œil nu, prédiction des passages et trace au sol.
 */
import {
  degreesLat,
  degreesLong,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  jday,
  propagate,
  radiansToDegrees,
  shadowFraction,
  sunPos,
  twoline2satrec,
  type SatRec,
} from 'satellite.js'
import type { ObserverLocation } from '../types/astro'
import type { SatellitePass, SatellitePassPoint, SatelliteState, TleRecord } from '../types/services'
import { getSunGeometricAltitudeDeg } from './astro/bodies'
import { isTleValidAt } from './satellite/tle'

export * from './satellite/tle'

/** Hauteur maximale du Soleil pour qu'un satellite éclairé soit visible (crépuscule civil). */
export const VISIBILITY_SUN_MAX_ALT_DEG = -6
/** Fraction d'ombre au-delà de laquelle le satellite est considéré éteint. */
const SHADOW_THRESHOLD = 0.5
const COARSE_STEP_MS = 60_000
const VISIBILITY_STEP_MS = 10_000

const satrecCache = new Map<string, SatRec>()

/** Satrec SGP4 mémoïsé par jeu de lignes. */
export function getSatrec(record: TleRecord): SatRec {
  const key = record.line1 + record.line2
  let satrec = satrecCache.get(key)
  if (!satrec) {
    satrec = twoline2satrec(record.line1, record.line2)
    satrecCache.set(key, satrec)
  }
  return satrec
}

function observerGeodetic(loc: ObserverLocation) {
  return {
    latitude: degreesToRadians(loc.latitudeDeg),
    longitude: degreesToRadians(loc.longitudeDeg),
    height: loc.elevationM / 1000,
  }
}

interface RawState {
  azimuthDeg: number
  elevationDeg: number
  rangeKm: number
  latitudeDeg: number
  longitudeDeg: number
  altitudeKm: number
  speedKmS: number
  shadowFraction: number
}

/**
 * Propagation SGP4 brute ; `null` si l'orbite a décru, si les éléments sont
 * invalides ou si `date` sort de la fenêtre de validité de ±30 j (`isTleValidAt`).
 */
export function propagateRaw(record: TleRecord, date: Date, loc: ObserverLocation): RawState | null {
  if (!isTleValidAt(record, date)) return null
  const pv = propagate(getSatrec(record), date)
  if (!pv) return null
  const gmst = gstime(date)
  const look = ecfToLookAngles(observerGeodetic(loc), eciToEcf(pv.position, gmst))
  const geo = eciToGeodetic(pv.position, gmst)
  const v = pv.velocity
  return {
    azimuthDeg: (radiansToDegrees(look.azimuth) + 360) % 360,
    elevationDeg: radiansToDegrees(look.elevation),
    rangeKm: look.rangeSat,
    latitudeDeg: degreesLat(geo.latitude),
    longitudeDeg: degreesLong(geo.longitude),
    altitudeKm: geo.height,
    speedKmS: Math.hypot(v.x, v.y, v.z),
    shadowFraction: shadowFraction(sunPos(jday(date)).rsun, pv.position),
  }
}

function isVisibleAt(raw: RawState, date: Date, loc: ObserverLocation): boolean {
  if (raw.elevationDeg <= 0 || raw.shadowFraction >= SHADOW_THRESHOLD) return false
  return getSunGeometricAltitudeDeg(date, loc) < VISIBILITY_SUN_MAX_ALT_DEG
}

/** État complet d'un satellite à l'instant `date`. */
export function getSatelliteState(record: TleRecord, date: Date, loc: ObserverLocation): SatelliteState | null {
  const raw = propagateRaw(record, date, loc)
  if (!raw) return null
  return { noradId: record.noradId, name: record.name, time: date, ...raw, visible: isVisibleAt(raw, date, loc) }
}

function elevationAt(record: TleRecord, t: number, loc: ObserverLocation): number {
  return propagateRaw(record, new Date(t), loc)?.elevationDeg ?? -90
}

/** Bissection du franchissement de `thresholdDeg` entre tLow et tHigh, à 1 s près. */
function refineCrossing(record: TleRecord, tA: number, tB: number, loc: ObserverLocation, thresholdDeg: number): number {
  const aboveA = elevationAt(record, tA, loc) >= thresholdDeg
  let [lo, hi] = [tA, tB]
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2
    if ((elevationAt(record, mid, loc) >= thresholdDeg) === aboveA) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Recherche ternaire de la culmination entre tA et tB (fonction unimodale), à 1 s près. */
function refineCulmination(record: TleRecord, tA: number, tB: number, loc: ObserverLocation): number {
  let [lo, hi] = [tA, tB]
  while (hi - lo > 1000) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (elevationAt(record, m1, loc) < elevationAt(record, m2, loc)) lo = m1
    else hi = m2
  }
  return (lo + hi) / 2
}

function passPoint(record: TleRecord, t: number, loc: ObserverLocation): SatellitePassPoint {
  const raw = propagateRaw(record, new Date(t), loc)
  return { time: new Date(t), azimuthDeg: raw?.azimuthDeg ?? 0, elevationDeg: raw?.elevationDeg ?? 0 }
}

function buildPass(record: TleRecord, riseMs: number, setMs: number, loc: ObserverLocation): SatellitePass {
  const culmMs = refineCulmination(record, riseMs, setMs, loc)
  let visibleFrom: number | null = null
  let visibleTo: number | null = null
  for (let t = riseMs; t <= setMs; t += VISIBILITY_STEP_MS) {
    const raw = propagateRaw(record, new Date(t), loc)
    if (raw && isVisibleAt(raw, new Date(t), loc)) {
      visibleFrom ??= t
      visibleTo = t
    }
  }
  return {
    noradId: record.noradId,
    name: record.name,
    rise: passPoint(record, riseMs, loc),
    culmination: passPoint(record, culmMs, loc),
    set: passPoint(record, setMs, loc),
    durationSec: Math.round((setMs - riseMs) / 1000),
    visible: visibleFrom !== null,
    visibleFrom: visibleFrom !== null ? new Date(visibleFrom) : null,
    visibleTo: visibleTo !== null ? new Date(visibleTo) : null,
  }
}

/**
 * Prédit les passages au-dessus de l'horizon sur `hours` heures.
 * @param minCulminationDeg écarte les passages rasants dont la culmination est inférieure.
 */
export function predictPasses(
  record: TleRecord,
  start: Date,
  hours: number,
  loc: ObserverLocation,
  minCulminationDeg = 10,
): SatellitePass[] {
  const passes: SatellitePass[] = []
  const endMs = start.getTime() + hours * 3_600_000
  let prevT = start.getTime()
  let prevEl = elevationAt(record, prevT, loc)
  let riseMs: number | null = prevEl >= 0 ? prevT : null
  for (let t = prevT + COARSE_STEP_MS; t <= endMs; t += COARSE_STEP_MS) {
    const el = elevationAt(record, t, loc)
    if (prevEl < 0 && el >= 0) riseMs = refineCrossing(record, prevT, t, loc, 0)
    if (prevEl >= 0 && el < 0 && riseMs !== null) {
      const setMs = refineCrossing(record, prevT, t, loc, 0)
      const pass = buildPass(record, riseMs, setMs, loc)
      if (pass.culmination.elevationDeg >= minCulminationDeg) passes.push(pass)
      riseMs = null
    }
    prevT = t
    prevEl = el
  }
  return passes
}

export interface GroundTrackPoint {
  readonly time: Date
  readonly latitudeDeg: number
  readonly longitudeDeg: number
}

/** Trace au sol sur `minutes` minutes à partir de `start` (points hors validité TLE omis). */
export function getGroundTrack(record: TleRecord, start: Date, minutes: number, stepSec = 30): GroundTrackPoint[] {
  const out: GroundTrackPoint[] = []
  const satrec = getSatrec(record)
  for (let s = 0; s <= minutes * 60; s += stepSec) {
    const time = new Date(start.getTime() + s * 1000)
    if (!isTleValidAt(record, time)) continue
    const pv = propagate(satrec, time)
    if (!pv) continue
    const geo = eciToGeodetic(pv.position, gstime(time))
    out.push({ time, latitudeDeg: degreesLat(geo.latitude), longitudeDeg: degreesLong(geo.longitude) })
  }
  return out
}
