/**
 * État du mode Caméra AR de l'onglet Ciel : caméra (via `useArCamera`), champ
 * optique de l'objectif 1× (65°, restauré à la sortie), calage manuel de la
 * boussole appliqué aux poses capteurs, renfort de visibilité et photo annotée.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { hapticSelection, hapticSuccess, hapticTick } from '../../services/haptics'
import { AR_DEFAULT_FOV_DEG, AR_MAX_FOV_DEG, AR_MIN_FOV_DEG, applyAzimuthOffset, clampArFov, offsetAfterDrag } from '../../services/sky/arCamera'
import { wrap360 } from '../../services/sky/vector'
import type { SkyView } from '../../types/sky'
import { composeArSnapshot, shareSnapshot, snapshotFileName } from './arCapture'
import { useArCamera } from './useArCamera'

export const AR_FOV_LIMITS = { min: AR_MIN_FOV_DEG, max: AR_MAX_FOV_DEG } as const

export function useArMode(active: boolean, viewRef: RefObject<SkyView>) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const offsetRef = useRef(0)
  const savedFov = useRef<number | null>(null)
  const lastTick = useRef(0)
  const [offsetDeg, setOffsetDeg] = useState(0)
  const [boost, setBoost] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const camera = useArCamera(active, videoRef)

  /** Entrée en AR : champ de l'objectif 1×, roulis remis à zéro (le précédent champ est mémorisé). */
  const enter = useCallback(() => {
    savedFov.current = viewRef.current.fovDeg
    viewRef.current = { ...viewRef.current, fovDeg: AR_DEFAULT_FOV_DEG, rollDeg: 0 }
  }, [viewRef])

  const leave = useCallback(() => {
    viewRef.current = { ...viewRef.current, fovDeg: savedFov.current ?? 90, rollDeg: 0 }
    savedFov.current = null
  }, [viewRef])

  /** Vue issue des capteurs, corrigée du calage boussole. */
  const corrected = useCallback((base: SkyView) => applyAzimuthOffset(base, offsetRef.current), [])

  /** Glissement horizontal : décale l'azimut pour aligner un astre sur son point lumineux réel. */
  const calibrate = useCallback((dxPx: number, widthPx: number) => {
    const v = viewRef.current
    const next = offsetAfterDrag(offsetRef.current, dxPx, widthPx, v.fovDeg)
    const delta = next - offsetRef.current
    offsetRef.current = next
    viewRef.current = { ...v, azimuthDeg: wrap360(v.azimuthDeg + delta) }
    const rounded = Math.round(next)
    setOffsetDeg((cur) => {
      if (cur !== rounded && performance.now() - lastTick.current > 60) {
        lastTick.current = performance.now()
        void hapticTick()
      }
      return rounded
    })
  }, [viewRef])

  const resetOffset = useCallback(() => {
    const v = viewRef.current
    viewRef.current = { ...v, azimuthDeg: wrap360(v.azimuthDeg - offsetRef.current) }
    offsetRef.current = 0
    setOffsetDeg(0)
    void hapticSelection()
  }, [viewRef])

  const zoom = useCallback((factor: number) => {
    viewRef.current = { ...viewRef.current, fovDeg: clampArFov(viewRef.current.fovDeg / factor) }
  }, [viewRef])

  const toggleBoost = useCallback(() => {
    setBoost((b) => !b)
    void hapticSelection()
  }, [])

  const closePreview = useCallback(() => {
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p.url)
      return null
    })
  }, [])
  useEffect(() => () => closePreview(), [closePreview])

  const capture = useCallback(async (redNight: boolean) => {
    const video = videoRef.current
    const sky = canvasRef.current
    if (!video || !sky || busy) return
    setBusy(true)
    try {
      const name = snapshotFileName(new Date())
      const url = await shareSnapshot(composeArSnapshot(video, sky, { boost, redNight }), name)
      void hapticSuccess()
      if (url) setPreview({ url, name })
    } finally {
      setBusy(false)
    }
  }, [boost, busy])

  return { videoRef, canvasRef, camera, offsetDeg, boost, busy, preview, enter, leave, corrected, calibrate, resetOffset, zoom, toggleBoost, capture, closePreview }
}
