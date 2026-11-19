/**
 * Cycle de vie de la caméra AR dans React : la caméra s'éteint (toutes les
 * pistes arrêtées) quand on quitte le mode AR, quand l'écran Ciel est démonté
 * (changement d'onglet) et quand l'app passe en arrière-plan.
 */
import { act, createElement, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStream } from '../../../services/__tests__/fakeMedia'
import { useArCamera, type ArCameraStatus } from '../useArCamera'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let status: ArCameraStatus = 'idle'
function Probe({ enabled }: { enabled: boolean }) {
  const [videoRef] = useState(() => ({ current: null as HTMLVideoElement | null }))
  const cam = useArCamera(enabled, videoRef)
  useEffect(() => {
    status = cam.status
  })
  return createElement('video', { ref: videoRef })
}

let root: Root
let host: HTMLDivElement
let streams: ReturnType<typeof fakeStream>[]
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const setVisibility = (v: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  streams = []
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => { const s = fakeStream(); streams.push(s); return s.stream }) },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  host = document.createElement('div')
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  setVisibility('visible')
  vi.restoreAllMocks()
})

describe('caméra AR : extinction stricte', () => {
  it('allume la caméra en mode AR et l’éteint en quittant le mode', async () => {
    act(() => root.render(createElement(Probe, { enabled: true })))
    await flush()
    expect(status).toBe('active')
    expect(host.querySelector('video')!.srcObject).toBe(streams[0].stream)
    act(() => root.render(createElement(Probe, { enabled: false })))
    expect(streams[0].tracks[0].stop).toHaveBeenCalled()
    expect(status).toBe('idle')
    expect(host.querySelector('video')!.srcObject).toBeNull()
  })

  it('changement d’onglet (démontage de l’écran Ciel) : pistes arrêtées', async () => {
    act(() => root.render(createElement(Probe, { enabled: true })))
    await flush()
    act(() => root.render(createElement('p')))
    expect(streams[0].tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(streams[0].tracks[0].readyState).toBe('ended')
  })

  it('arrière-plan : caméra coupée, rallumée au retour au premier plan', async () => {
    act(() => root.render(createElement(Probe, { enabled: true })))
    await flush()
    act(() => setVisibility('hidden'))
    expect(streams[0].tracks[0].readyState).toBe('ended')
    act(() => setVisibility('visible'))
    await flush()
    expect(streams).toHaveLength(2)
    expect(streams[1].tracks[0].readyState).toBe('live')
  })

  it('autorisation refusée : statut « denied », aucune piste laissée ouverte', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw Object.assign(new Error('refus'), { name: 'NotAllowedError' }) } },
    })
    act(() => root.render(createElement(Probe, { enabled: true })))
    await flush()
    expect(status).toBe('denied')
  })
})
