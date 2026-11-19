/**
 * Pilotage du planétarium par les capteurs iOS : autorisation explicite
 * (`DeviceOrientationEvent.requestPermission`, à appeler sur un geste), fusion
 * boussole + inclinaison, filtre passe-bas, et repli automatique vers le tactile
 * si aucune mesure exploitable n'arrive (navigateur de bureau, refus, capteur absent).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { OrientationFilter, cameraPoseFromOrientation, sampleFromEvent } from '../../services/sky/orientation'
import type { CameraPose } from '../../types/sky'

export type SensorStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable'

/** Délai sans mesure valide avant de déclarer les capteurs inactifs. */
const WATCHDOG_MS = 1500

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> }

export function useOrientationControl(onPose: (pose: CameraPose) => void, onFallback: (status: 'denied' | 'unavailable') => void) {
  const [status, setStatus] = useState<SensorStatus>('idle')
  const cb = useRef({ onPose, onFallback })
  useEffect(() => {
    cb.current = { onPose, onFallback }
  })
  const cleanup = useRef<() => void>(() => {})

  const stop = useCallback(() => {
    cleanup.current()
    cleanup.current = () => {}
    setStatus('idle')
  }, [])

  const fail = useCallback((s: 'denied' | 'unavailable') => {
    cleanup.current()
    cleanup.current = () => {}
    setStatus(s)
    cb.current.onFallback(s)
  }, [])

  /** À appeler depuis un gestionnaire de toucher (exigence iOS 13+). */
  const start = useCallback(async () => {
    cleanup.current()
    const Ctor = (globalThis as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent
    if (!Ctor) return fail('unavailable')
    setStatus('requesting')
    if (typeof Ctor.requestPermission === 'function') {
      try {
        if ((await Ctor.requestPermission()) !== 'granted') return fail('denied')
      } catch {
        return fail('denied')
      }
    }
    const filter = new OrientationFilter(120)
    let gotData = false
    const handler = (e: Event) => {
      const sample = sampleFromEvent(e as DeviceOrientationEvent & { webkitCompassHeading?: number }, performance.now())
      const pose = cameraPoseFromOrientation(sample)
      if (!pose) return
      if (!gotData) {
        gotData = true
        setStatus('active')
      }
      cb.current.onPose(filter.update(pose, sample.timeMs))
    }
    // Hors iOS, l'évènement « absolute » fournit un alpha référencé au nord.
    const eventName = 'ondeviceorientationabsolute' in globalThis ? 'deviceorientationabsolute' : 'deviceorientation'
    globalThis.addEventListener(eventName, handler)
    const watchdog = setTimeout(() => {
      if (!gotData) fail('unavailable')
    }, WATCHDOG_MS)
    cleanup.current = () => {
      clearTimeout(watchdog)
      globalThis.removeEventListener(eventName, handler)
    }
  }, [fail])

  useEffect(() => () => cleanup.current(), [])

  return { status, start, stop }
}
