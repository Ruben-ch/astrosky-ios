/**
 * État React initialisé depuis le cache hors-ligne puis sauvegardé à chaque
 * modification utilisateur. Tant que la lecture asynchrone n'est pas revenue,
 * la valeur par défaut est affichée ; une modification précoce l'emporte.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function usePersistedState<T>(
  initial: T,
  load: () => Promise<T>,
  save: (value: T) => Promise<void>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial)
  const touched = useRef(false)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    let alive = true
    load()
      .then((v) => {
        if (alive && !touched.current) setValue(v)
      })
      .catch(() => {
        /* stockage indisponible : valeur par défaut */
      })
    return () => {
      alive = false
    }
    // Lecture unique au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    touched.current = true
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      void saveRef.current(v).catch(() => undefined)
      return v
    })
  }, [])

  return [value, update]
}
