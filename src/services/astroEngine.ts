/**
 * Moteur d'éphémérides AstroSky — façade unique des calculs astronomiques.
 * Implémentation découpée dans `src/services/astro/` ; toute la mécanique
 * céleste repose sur astronomy-engine (VSOP87 / ELP / IAU 2006).
 */
import type { ObserverLocation } from '../types/astro'
import { getSolarSystemEphemerides } from './astro/bodies'
import { getMoonInfo } from './astro/moon'
import { getActiveMeteorShowers } from './astro/meteors'
import { getRiseTransitSet, getTwilightTimes, observingNightStart } from './astro/riseSet'
import { SOLAR_SYSTEM_BODIES } from './astro/bodies'

export {
  BODY_NAME_FR,
  PLANETS,
  SOLAR_SYSTEM_BODIES,
  angularDiameterArcsec,
  getBodyEphemeris,
  getBodyEquatorJ2000,
  getBodyHorizontal,
  getSunGeometricAltitudeDeg,
  getSolarSystemEphemerides,
  toObserver,
} from './astro/bodies'
export { getDarkWindow, getRiseTransitSet, getTwilightTimes, observingNightStart, TWILIGHT_ALTITUDE_DEG } from './astro/riseSet'
export { getMoonInfo, MOON_PHASE_FR, nextMoonQuarters, phaseNameFromAngle, previousNewMoon, QUARTER_FR } from './astro/moon'
export {
  azimuthToCardinal,
  computeDeepSkyVisibility,
  createSkyProjector,
  getAltitudeCurve,
  targetHorizontal,
  type SkyProjector,
} from './astro/skyProjector'
export {
  activityWindow,
  estimateLimitingMagnitude,
  expectedHourlyRate,
  getActiveMeteorShowers,
  nearestShowerPeak,
  nextShowerPeak,
  searchSunLongitudeAfter,
  solarLongitudeOfDate,
} from './astro/meteors'
export { getUpcomingEvents } from './astro/events'

/** Synthèse « Ce soir » : tout ce qu'il faut pour planifier la nuit d'observation. */
export function getNightSummary(date: Date, loc: ObserverLocation) {
  const noon = observingNightStart(date, loc)
  return {
    nightStart: noon,
    twilight: getTwilightTimes(date, loc),
    moon: getMoonInfo(date),
    bodies: getSolarSystemEphemerides(date, loc),
    riseSet: Object.fromEntries(SOLAR_SYSTEM_BODIES.map((id) => [id, getRiseTransitSet(id, noon, loc)])),
    meteorShowers: getActiveMeteorShowers(date, loc),
  }
}

export type NightSummary = ReturnType<typeof getNightSummary>

export {
  TWILIGHT_PHASE_FR,
  getNightTimeline,
  intervalMinutes,
  moonUpIntervals,
  nextTransition,
  phaseForSunAltitude,
  segmentAt,
  subtractIntervals,
} from './astro/nightTimeline'
export { getMoonDetail, illuminationCurve, nextMoonPhase } from './astro/moonDetail'
export { TIME_JUMP_LABEL_FR, getTimeJumps, type TimeJump, type TimeJumpId } from './astro/timeJumps'
