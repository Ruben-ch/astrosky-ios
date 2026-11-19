/**
 * Données astronomiques de la nuit d'observation dérivées de l'horloge de
 * simulation. Les calculs lourds sont mémoïsés par quantum de temps et par lieu.
 */
import { useMemo } from 'react'
import type { ObserverLocation, SolarSystemBodyId } from '../types/astro'
import {
  PLANETS,
  getAltitudeCurve,
  getBodyHorizontal,
  getMoonDetail,
  getMoonInfo,
  getNightTimeline,
  getNightSummary,
  getUpcomingEvents,
  observingNightStart,
} from '../services/astroEngine'
import { useObserver } from './useAppContext'
import { useSimTime } from './useSimTime'

const MINUTE = 60_000
const DAY = 86_400_000
const CURVE_STEP_MS = 10 * MINUTE

/** Position quantifiée (4 décimales ≈ 11 m) pour stabiliser les mémoïsations. */
function useStableLocation(): ObserverLocation {
  const { location } = useObserver()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  return useMemo(
    () => ({ latitudeDeg, longitudeDeg, elevationM }),
    [latitudeDeg, longitudeDeg, elevationM],
  )
}

export function useNightData() {
  const loc = useStableLocation()
  const now = useSimTime(1000, MINUTE)
  const nowMs = now.getTime()

  const summary = useMemo(() => getNightSummary(new Date(nowMs), loc), [nowMs, loc])
  const nightStartMs = summary.nightStart.getTime()

  const curves = useMemo(() => {
    const start = new Date(nightStartMs)
    const ids: SolarSystemBodyId[] = ['Sun', 'Moon', ...PLANETS]
    return Object.fromEntries(ids.map((id) => [id, getAltitudeCurve({ kind: 'body', id }, start, DAY, CURVE_STEP_MS, loc)])) as Record<
      SolarSystemBodyId,
      ReturnType<typeof getAltitudeCurve>
    >
  }, [nightStartMs, loc])

  const dayMs = Math.floor(nowMs / DAY) * DAY
  const events = useMemo(() => getUpcomingEvents(new Date(dayMs), 45, loc), [dayMs, loc])

  // Décalage d'une minute : garantit que la recherche du midi solaire retombe sur cette nuit.
  const timeline = useMemo(() => getNightTimeline(new Date(nightStartMs + MINUTE), loc), [nightStartMs, loc])
  const moon = useMemo(() => getMoonDetail(new Date(nowMs), loc), [nowMs, loc])

  return { now, loc, summary, curves, events, timeline, moon }
}

export type NightData = ReturnType<typeof useNightData>

/** Conditions lunaires à un instant donné, pour pondérer le score météo. */
export function moonConditionAt(time: Date, loc: ObserverLocation) {
  return { illuminated: getMoonInfo(time).illuminatedFraction, altitudeDeg: getBodyHorizontal('Moon', time, loc).altitudeDeg }
}

export { observingNightStart }
