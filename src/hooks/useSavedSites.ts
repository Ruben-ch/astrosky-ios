/** Favoris et sites récents, rechargés depuis le cache et mis à jour localement. */
import { useCallback, useEffect, useState } from 'react'
import { listFavorites, listRecents, removeFavorite, toggleFavorite } from '../services/location/savedSites'
import { hapticSelection, hapticSuccess } from '../services/haptics'
import type { SavedSite } from '../types/location'

export function useSavedSites() {
  const [favorites, setFavorites] = useState<SavedSite[]>([])
  const [recents, setRecents] = useState<SavedSite[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([listFavorites(), listRecents()]).then(([f, r]) => {
      if (cancelled) return
      setFavorites(f)
      setRecents(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(async (site: SavedSite) => {
    const next = await toggleFavorite(site)
    setFavorites(next)
    void (next.length > favorites.length ? hapticSuccess() : hapticSelection())
  }, [favorites.length])

  const remove = useCallback(async (id: string) => {
    setFavorites(await removeFavorite(id))
    void hapticSelection()
  }, [])

  return { favorites, recents, toggle, remove }
}
