/** Flux vidéo factice pour les tests : `stop()` passe chaque piste à `ended`. */
import { vi } from 'vitest'

export function fakeStream(n = 1) {
  const tracks = Array.from({ length: n }, () => {
    const t = { readyState: 'live' as MediaStreamTrackState, stop: vi.fn(() => { t.readyState = 'ended' }) }
    return t
  })
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }
}
