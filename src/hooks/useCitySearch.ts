/** Recherche de villes temporisée (anti-rebond) avec annulation des réponses obsolètes. */
import { useEffect, useState } from 'react'
import { MIN_QUERY_LENGTH, searchCities } from '../services/location/citySearch'
import { normalizeText } from '../services/location/geodesy'
import type { CitySearchResponse } from '../types/location'

const DEBOUNCE_MS = 280

export function useCitySearch(query: string): { response: CitySearchResponse | null; searching: boolean } {
  const [response, setResponse] = useState<CitySearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const active = normalizeText(query).length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      searchCities(query)
        .then((r) => {
          if (!cancelled) setResponse(r)
        })
        .catch(() => {
          if (!cancelled) setResponse({ query, results: [], mode: 'offline' })
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, active])

  return { response: active ? response : null, searching: active && searching }
}
