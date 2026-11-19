/**
 * État du planétarium hors rendu : préférences persistées, vue courante (ref,
 * lue à 60 fps), sélection, cible de guidage (y compris reçue du Catalogue),
 * relevé du centre de vue (5 Hz) et centrage animé sur un objet.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation, useObserver, useSimulation } from '../../hooks/useAppContext'
import { normalizeView } from '../../services/sky/projection'
import { eqjToEnuMatrix } from '../../services/sky/skyFrame'
import { isSatelliteUnavailable, objectDirection, resolveSkyObject } from '../../services/sky/skyObjects'
import { DEFAULT_SKY_SETTINGS, loadSkySettings, saveSkySettings } from '../../services/sky/skySettings'
import { toHorizontal } from '../../services/sky/vector'
import type { SkyObjectRef, SkySettings, SkyView } from '../../types/sky'

const DEFAULT_VIEW: SkyView = { azimuthDeg: 180, altitudeDeg: 35, fovDeg: 90, rollDeg: 0 }
const CENTER_ANIM_MS = 650

function param(name: string): string | null {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get(name)
  } catch {
    return null
  }
}

/** Vue initiale : `?sky=az,alt,fov` (inspection déterministe) ou vue plein sud. */
function initialView(): SkyView {
  const parts = param('sky')?.split(',').map(Number)
  if (parts && parts.length === 3 && parts.every(Number.isFinite)) {
    return normalizeView({ azimuthDeg: parts[0], altitudeDeg: parts[1], fovDeg: parts[2], rollDeg: 0 })
  }
  return DEFAULT_VIEW
}

export function useSkyController() {
  const sim = useSimulation()
  const { location } = useObserver()
  const { skyFocus, clearSkyFocus } = useNavigation()
  const [settings, setSettings] = useState<SkySettings>(DEFAULT_SKY_SETTINGS)
  const [view0] = useState(initialView)
  const viewRef = useRef<SkyView>(view0)
  const [readout, setReadout] = useState<SkyView>(view0)
  const loc = { latitudeDeg: location.latitudeDeg, longitudeDeg: location.longitudeDeg, elevationM: location.elevationM }
  const resolve = (key: string | null) => (key ? resolveSkyObject(key, new Date(sim.getSimMs()), loc) : null)
  const [selected, setSelected] = useState<SkyObjectRef | null>(() => resolve(skyFocus?.key ?? param('guide') ?? param('select')))
  const [target, setTarget] = useState<SkyObjectRef | null>(() => resolve(skyFocus?.key ?? param('guide')))
  const [locked, setLocked] = useState(false)
  const [handledNonce, setHandledNonce] = useState<number | null>(skyFocus?.nonce ?? null)
  const animRaf = useRef(0)

  // Demande de guidage reçue pendant que l'écran est monté (état dérivé).
  if (skyFocus && skyFocus.nonce !== handledNonce) {
    setHandledNonce(skyFocus.nonce)
    const ref = resolve(skyFocus.key)
    setSelected(ref)
    setTarget(ref)
    setLocked(false)
  }
  useEffect(() => {
    if (skyFocus && skyFocus.nonce === handledNonce) clearSkyFocus(skyFocus.nonce)
  }, [skyFocus, handledNonce, clearSkyFocus])

  useEffect(() => {
    let cancelled = false
    void loadSkySettings().then((s) => {
      if (!cancelled) setSettings((cur) => ({ ...s, mode: cur.mode }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<SkySettings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch }
      void saveSkySettings(next)
      return next
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const v = viewRef.current
      setReadout((r) => (Math.abs(r.azimuthDeg - v.azimuthDeg) < 0.05 && Math.abs(r.altitudeDeg - v.altitudeDeg) < 0.05 && Math.abs(r.fovDeg - v.fovDeg) < 0.05 ? r : v))
    }, 200)
    return () => clearInterval(id)
  }, [])

  const cancelAnimation = useCallback(() => cancelAnimationFrame(animRaf.current), [])

  /** Centre la vue sur un objet (interpolation en azimut/hauteur, ease-out cubique). */
  const centerOn = useCallback((ref: SkyObjectRef) => {
    const date = new Date(sim.getSimMs())
    if (isSatelliteUnavailable(ref, date)) return
    const l = { latitudeDeg: location.latitudeDeg, longitudeDeg: location.longitudeDeg, elevationM: location.elevationM }
    const to = toHorizontal(objectDirection(ref, date, l, eqjToEnuMatrix(date, l)))
    const from = viewRef.current
    const dAz = ((to.azimuthDeg - from.azimuthDeg + 540) % 360) - 180
    const t0 = performance.now()
    cancelAnimationFrame(animRaf.current)
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / CENTER_ANIM_MS)
      const e = 1 - (1 - k) ** 3
      viewRef.current = normalizeView({ ...viewRef.current, azimuthDeg: from.azimuthDeg + dAz * e, altitudeDeg: from.altitudeDeg + (to.altitudeDeg - from.altitudeDeg) * e })
      if (k < 1) animRaf.current = requestAnimationFrame(step)
    }
    animRaf.current = requestAnimationFrame(step)
  }, [sim, location.latitudeDeg, location.longitudeDeg, location.elevationM])

  useEffect(() => () => cancelAnimationFrame(animRaf.current), [])

  const startGuidance = useCallback((ref: SkyObjectRef) => {
    setTarget(ref)
    setLocked(false)
  }, [])
  const stopGuidance = useCallback(() => {
    setTarget(null)
    setLocked(false)
  }, [])

  return {
    settings, updateSettings, viewRef, readout, selected, setSelected, target, startGuidance, stopGuidance,
    locked, setLocked, centerOn, cancelAnimation, loc,
  }
}
