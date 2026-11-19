/**
 * Flux vidéo de la caméra arrière pour le mode AR. La caméra n'est allumée que
 * tant que `enabled` est vrai ET que l'app est au premier plan : quitter le mode
 * AR, changer d'onglet (démontage de l'écran Ciel) ou passer en arrière-plan
 * (`visibilitychange`, `pagehide`) arrête immédiatement toutes les pistes.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArCameraSession, cameraErrorReason, isCancelled, type ArCameraError } from '../../services/sky/arCamera'

export type ArCameraStatus = 'idle' | 'starting' | 'active' | ArCameraError

export function useArCamera(enabled: boolean, videoRef: RefObject<HTMLVideoElement | null>) {
  const session = useMemo(() => new ArCameraSession(), [])
  const [status, setStatus] = useState<ArCameraStatus>('idle')
  const [attempt, setAttempt] = useState(0)
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  })

  const detach = useCallback(() => {
    session.stop()
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [session, videoRef])

  const open = useCallback(async () => {
    setStatus('starting')
    try {
      const stream = await session.start()
      const v = videoRef.current
      if (!v || !enabledRef.current) return detach()
      v.srcObject = stream
      await v.play().catch(() => undefined) // autoplay muet : l'échec éventuel n'empêche pas l'image
      setStatus('active')
    } catch (e) {
      if (!isCancelled(e)) setStatus(cameraErrorReason(e))
    }
  }, [session, videoRef, detach])

  useEffect(() => {
    if (!enabled) {
      detach()
      return
    }
    // Synchronisation avec un système externe (caméra) : le statut « starting » est voulu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void open()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') detach()
      else if (enabledRef.current) void open()
    }
    document.addEventListener('visibilitychange', onVisibility)
    globalThis.addEventListener('pagehide', detach)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      globalThis.removeEventListener('pagehide', detach)
      detach()
    }
  }, [enabled, attempt, open, detach])

  /** Nouvelle tentative après une erreur (autorisation accordée entre-temps dans Réglages). */
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  // Hors mode AR, le statut est toujours « idle » (dérivé, sans re-rendu en cascade).
  return { status: enabled ? status : 'idle', retry, session }
}
