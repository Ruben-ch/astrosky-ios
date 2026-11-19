/**
 * Horloge de simulation globale. L'ancre est stockée dans un ref (lecture
 * instantanée sans re-rendu pour les boucles 60 fps via `getSimMs`) et dans un
 * état React (re-rendu des contrôles quand vitesse/décalage changent).
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { SimulationContext, type SimulationApi } from './contexts'
import type { ClockAnchor } from '../types/services'
import {
  createAnchor,
  isLive as isLiveAt,
  jumpTo as jumpAnchor,
  resetToNow,
  shiftBy as shiftAnchor,
  simTimeAt,
  withRate,
} from '../services/simulationClock'

export function SimulationProvider({ children, initialMs }: { children: ReactNode; initialMs?: number }) {
  const [anchor, setAnchor] = useState<ClockAnchor>(() => createAnchor(Date.now(), initialMs ?? Date.now()))
  const anchorRef = useRef(anchor)

  const commit = useCallback((next: ClockAnchor) => {
    anchorRef.current = next
    setAnchor(next)
  }, [])

  const getSimMs = useCallback(() => simTimeAt(anchorRef.current, Date.now()), [])
  const setRate = useCallback((rate: number) => commit(withRate(anchorRef.current, rate, Date.now())), [commit])
  const shiftBy = useCallback((deltaMs: number) => commit(shiftAnchor(anchorRef.current, deltaMs, Date.now())), [commit])
  const jumpTo = useCallback((simMs: number) => commit(jumpAnchor(anchorRef.current, simMs, Date.now())), [commit])
  const goLive = useCallback(() => commit(resetToNow(Date.now())), [commit])
  const isLive = useCallback(() => isLiveAt(anchorRef.current, Date.now()), [])

  const api = useMemo<SimulationApi>(
    () => ({ getSimMs, anchor, rate: anchor.rate, setRate, shiftBy, jumpTo, goLive, isLive }),
    [anchor, getSimMs, setRate, shiftBy, jumpTo, goLive, isLive],
  )
  return <SimulationContext.Provider value={api}>{children}</SimulationContext.Provider>
}
