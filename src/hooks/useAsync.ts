/** Exécution d'une tâche asynchrone liée à des dépendances, avec annulation logique. */
import { useCallback, useEffect, useState, type DependencyList } from 'react'

export interface AsyncState<T> {
  readonly data: T | null
  readonly error: Error | null
  readonly loading: boolean
  reload(): void
}

export function useAsync<T>(task: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    task()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}
