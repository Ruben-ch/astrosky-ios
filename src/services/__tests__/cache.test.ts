import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheGet,
  cacheReadStale,
  cacheRemove,
  cacheSet,
  cachedFetch,
  localStorageAdapter,
  setCacheStorage,
} from '../cache'
import { createMemoryStorage } from './memoryStorage'

describe('cache TTL', () => {
  let mem: ReturnType<typeof createMemoryStorage>
  beforeEach(() => {
    mem = createMemoryStorage()
    setCacheStorage(mem)
  })

  it('renvoie une valeur fraîche puis null après expiration', async () => {
    await cacheSet('k', { a: 1 }, 1000, 0)
    expect(await cacheGet('k', 500)).toEqual({ a: 1 })
    expect(await cacheGet('k', 1500)).toBeNull()
    const stale = await cacheReadStale<{ a: number }>('k')
    expect(stale?.value).toEqual({ a: 1 })
    expect(stale?.storedAt).toBe(0)
  })

  it('ignore les entrées corrompues', async () => {
    mem.data.set('astrosky:bad', '{not json')
    expect(await cacheGet('bad')).toBeNull()
    mem.data.set('astrosky:shape', JSON.stringify({ foo: 1 }))
    expect(await cacheReadStale('shape')).toBeNull()
  })

  it('supprime une entrée', async () => {
    await cacheSet('k', 1, 1000)
    await cacheRemove('k')
    expect(await cacheReadStale('k')).toBeNull()
  })

  it('cachedFetch : cache → réseau → cache périmé', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1')
    const r1 = await cachedFetch('f', 1000, fetcher, { nowMs: 0 })
    expect(r1).toEqual({ value: 'v1', storedAt: 0, origin: 'network' })
    const r2 = await cachedFetch('f', 1000, fetcher, { nowMs: 100 })
    expect(r2.origin).toBe('cache')
    expect(fetcher).toHaveBeenCalledTimes(1)

    fetcher.mockRejectedValueOnce(new Error('offline'))
    const r3 = await cachedFetch('f', 1000, fetcher, { nowMs: 5000 })
    expect(r3).toEqual({ value: 'v1', storedAt: 0, origin: 'stale-cache' })
  })

  it('cachedFetch force le réseau et propage l’erreur sans donnée', async () => {
    const fetcher = vi.fn().mockResolvedValue('v2')
    await cacheSet('g', 'v1', 10_000, 0)
    expect((await cachedFetch('g', 10_000, fetcher, { force: true, nowMs: 1 })).value).toBe('v2')
    await expect(cachedFetch('none', 1000, () => Promise.reject(new Error('x')))).rejects.toThrow('x')
  })

  it('adaptateur localStorage fonctionne en jsdom', async () => {
    await localStorageAdapter.set('x', 'y')
    expect(await localStorageAdapter.get('x')).toBe('y')
    await localStorageAdapter.remove('x')
    expect(await localStorageAdapter.get('x')).toBeNull()
  })
})
