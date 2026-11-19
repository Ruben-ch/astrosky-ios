/**
 * Abonnements à l'horloge de simulation.
 * - `useSimTime(periodMs)` : re-rendu périodique, pour les écrans de données.
 * - `useSimFrame(cb)` : callback à chaque frame rAF sans re-rendu, pour les Canvas.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSimulation } from './useAppContext'

/**
 * Temps simulé quantifié : renvoie une `Date` arrondie à `quantumMs` et ne
 * re-rend que lorsque ce quantum change (vérifié toutes les `periodMs`).
 */
export function useSimTime(periodMs = 1000, quantumMs = 1000): Date {
  const { getSimMs, anchor } = useSimulation()
  const quantize = (ms: number) => Math.floor(ms / quantumMs) * quantumMs
  const [simMs, setSimMs] = useState(() => quantize(getSimMs()))

  useEffect(() => {
    const tick = () => {
      const next = Math.floor(getSimMs() / quantumMs) * quantumMs
      setSimMs((prev) => (prev === next ? prev : next))
    }
    tick()
    const id = setInterval(tick, periodMs)
    return () => clearInterval(id)
  }, [getSimMs, periodMs, quantumMs, anchor])

  return useMemo(() => new Date(simMs), [simMs])
}

/** Lecture conjointe temps simulé / temps réel (ms), rafraîchie toutes les `periodMs`. */
export function useClockReadout(periodMs = 250): { simMs: number; realMs: number } {
  const { getSimMs, anchor } = useSimulation()
  const [readout, setReadout] = useState(() => ({ simMs: anchor.simMs, realMs: anchor.realMs }))
  useEffect(() => {
    const tick = () => {
      const realMs = Date.now()
      const simMs = Math.floor(getSimMs() / 1000) * 1000
      setReadout((prev) => (prev.simMs === simMs && Math.abs(prev.realMs - realMs) < 1000 ? prev : { simMs, realMs }))
    }
    tick()
    const id = setInterval(tick, periodMs)
    return () => clearInterval(id)
  }, [getSimMs, periodMs, anchor])
  return readout
}

/** Appelle `onFrame(simMs)` à chaque frame tant que le composant est monté. */
export function useSimFrame(onFrame: (simMs: number) => void): void {
  const { getSimMs } = useSimulation()
  const cbRef = useRef(onFrame)
  useEffect(() => {
    cbRef.current = onFrame
  }, [onFrame])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      cbRef.current(getSimMs())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getSimMs])
}
