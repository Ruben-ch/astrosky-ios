/**
 * Passages visibles sur 48 h, calculés en tâche de fond découpée (60 fps
 * préservés) et recalculés par tranche de 6 h de temps simulé ou au
 * changement de lieu / d'éléments. Résultats mémoïsés entre deux montages.
 */
import { useEffect, useState } from 'react'
import { DEFAULT_PASS_OPTIONS, predictVisiblePassesAsync } from '../services/satellite/visiblePasses'
import type { ObserverLocation } from '../types/astro'
import type { OrbitalCandidate, PassPredictionProgress, VisiblePass } from '../types/orbital'

/** Granularité du recalcul, en temps simulé. */
export const PASS_BUCKET_MS = 6 * 3_600_000

interface State {
  readonly key: string
  readonly passes: readonly VisiblePass[]
  readonly progress: PassPredictionProgress
  readonly done: boolean
}

let memo: State | null = null

export function passBucketOf(simMs: number): number {
  return Math.floor(simMs / PASS_BUCKET_MS) * PASS_BUCKET_MS
}

export function useVisiblePasses(candidates: readonly OrbitalCandidate[], bucketMs: number, loc: ObserverLocation): State {
  const key = `${bucketMs}|${loc.latitudeDeg.toFixed(3)},${loc.longitudeDeg.toFixed(3)}|${candidates.map((c) => `${c.record.noradId}:${c.record.line1.slice(18, 32)}`).join(',')}`
  const [state, setState] = useState<State>(() =>
    memo?.key === key ? memo : { key, passes: [], progress: { done: 0, total: candidates.length }, done: candidates.length === 0 },
  )

  useEffect(() => {
    if (memo?.key === key && memo.done) {
      setState(memo)
      return
    }
    if (candidates.length === 0) return
    const ctrl = new AbortController()
    setState({ key, passes: [], progress: { done: 0, total: candidates.length }, done: false })
    // Fenêtre : 2 h avant le début de la tranche pour couvrir un passage en cours.
    predictVisiblePassesAsync(candidates, new Date(bucketMs - 2 * 3_600_000), loc, { ...DEFAULT_PASS_OPTIONS, hours: 50 }, {
      signal: ctrl.signal,
      onProgress: (progress, partial) => setState({ key, passes: partial, progress, done: false }),
    })
      .then((passes) => {
        memo = { key, passes, progress: { done: candidates.length, total: candidates.length }, done: true }
        setState(memo)
      })
      .catch(() => {
        /* annulé : un nouveau calcul a pris le relais */
      })
    return () => ctrl.abort()
    // `key` résume candidats, tranche et lieu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state.key === key ? state : { key, passes: [], progress: { done: 0, total: candidates.length }, done: false }
}
