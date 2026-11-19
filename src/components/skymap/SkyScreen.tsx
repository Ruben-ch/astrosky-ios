/**
 * Onglet « Ciel » : planétarium plein cadre (Canvas 2D 60 fps) piloté au doigt
 * ou par les capteurs iOS, avec sélection d'objets et mode Guidage Cible
 * (flèche directionnelle + retours haptiques jusqu'au pointage).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigation, useSimulation, useTheme } from '../../hooks/useAppContext'
import { useSimTime } from '../../hooks/useSimTime'
import { hapticLock, hapticSelection, hapticSuccess, hapticTick, hapticWarning } from '../../services/haptics'
import { pointingDelta } from '../../services/sky/guidance'
import { viewFromPose } from '../../services/sky/orientation'
import { zoomView } from '../../services/sky/projection'
import { loadSkyCatalog } from '../../services/sky/skyCatalog'
import { eqjToEnuMatrix } from '../../services/sky/skyFrame'
import { isSatelliteUnavailable, objectDirection } from '../../services/sky/skyObjects'
import { TLE_VALIDITY_MESSAGE } from '../../services/satellite/tle'
import { toHorizontal } from '../../services/sky/vector'
import type { GuidanceEvent, SkyControlMode } from '../../types/sky'
import { fmtNumber } from '../ui/format'
import { ArCameraAlert, ArSnapshotPreview, ArToolbar, ArVideo } from './ArOverlay'
import { SkyCanvas } from './SkyCanvas'
import { SkyEngine } from './skyEngine'
import { SkyTelemetryBadge, SkyTopBar, SkyZoomControls } from './SkyHud'
import { SkyLayersSheet } from './SkyLayersSheet'
import { SkyGuidanceBar, SkyObjectCard } from './SkyObjectCard'
import { useOrientationControl } from './useOrientationControl'
import { AR_FOV_LIMITS, useArMode } from './useArMode'
import { useSkyController } from './useSkyController'

export function SkyScreen() {
  const c = useSkyController()
  const sim = useSimulation()
  const { immersive, setImmersive, focusInCatalog } = useNavigation()
  const [engine, setEngine] = useState<SkyEngine | null>(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const minute = useSimTime(1000, 60_000).getTime()
  const { theme } = useTheme()
  const isAr = c.settings.mode === 'ar'
  const ar = useArMode(isAr, c.viewRef)

  useEffect(() => {
    let cancelled = false
    void loadSkyCatalog().then((cat) => {
      if (!cancelled) setEngine(new SkyEngine(cat))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const sensors = useOrientationControl(
    (pose) => {
      const base = viewFromPose(pose, c.viewRef.current.fovDeg)
      c.viewRef.current = isAr ? ar.corrected(base) : base
    },
    (status) => {
      if (isAr) {
        // La vidéo reste utile : la vue AR s'oriente alors au doigt.
        c.viewRef.current = { ...c.viewRef.current, rollDeg: 0 }
        setNotice(status === 'denied' ? 'Accès aux capteurs refusé — glissez pour orienter la vue AR' : 'Capteurs inactifs — glissez pour orienter la vue AR')
        void hapticWarning()
        return
      }
      c.updateSettings({ mode: 'touch' })
      c.viewRef.current = { ...c.viewRef.current, rollDeg: 0 }
      setNotice(status === 'denied' ? 'Accès aux capteurs refusé — contrôle tactile activé' : 'Capteurs inactifs — contrôle tactile activé')
      void hapticWarning()
    },
  )

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  const setMode = (mode: SkyControlMode) => {
    if (mode === c.settings.mode) return
    void hapticSelection()
    c.cancelAnimation()
    if (isAr) ar.leave()
    if (mode === 'ar') ar.enter()
    c.updateSettings({ mode })
    if (mode === 'sensors' || mode === 'ar') void sensors.start()
    else {
      sensors.stop()
      c.viewRef.current = { ...c.viewRef.current, rollDeg: 0 }
    }
  }
  const sensorsLive = sensors.status === 'active'

  const onGuidanceEvent = (e: GuidanceEvent) => {
    if (e === 'pulse') void hapticTick()
    if (e === 'lock') void hapticSuccess()
    if (e === 'unlock') void hapticSelection()
    c.setLocked(e === 'lock')
  }

  // Consigne textuelle du guidage, recalculée avec le relevé de vue (5 Hz).
  const hint = useMemo(() => {
    if (!c.target) return ''
    const date = new Date(sim.getSimMs())
    if (isSatelliteUnavailable(c.target, date)) return TLE_VALIDITY_MESSAGE
    const to = toHorizontal(objectDirection(c.target, date, c.loc, eqjToEnuMatrix(date, c.loc)))
    const d = pointingDelta(c.readout.azimuthDeg, c.readout.altitudeDeg, to.azimuthDeg, to.altitudeDeg)
    const parts = [
      Math.abs(d.dAzDeg) >= 1 ? `${d.dAzDeg > 0 ? '→' : '←'} ${fmtNumber(Math.abs(d.dAzDeg), 0)}° ${d.dAzDeg > 0 ? 'à droite' : 'à gauche'}` : null,
      Math.abs(d.dAltDeg) >= 1 ? `${d.dAltDeg > 0 ? '↑ levez' : '↓ baissez'} de ${fmtNumber(Math.abs(d.dAltDeg), 0)}°` : null,
    ].filter(Boolean)
    const below = to.altitudeDeg < 0 ? ' · sous l’horizon' : ''
    return (parts.join(' · ') || 'Dans l’axe') + below
    // `minute` fait suivre la cible quand le temps simulé avance sans geste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.target, c.readout, c.loc.latitudeDeg, c.loc.longitudeDeg, minute])

  const zoom = (factor: number) => {
    if (isAr) {
      ar.zoom(factor)
      void hapticTick()
      return
    }
    const el = document.querySelector('[data-sky-root]')
    const w = el?.clientWidth ?? 393
    const h = el?.clientHeight ?? 600
    c.viewRef.current = zoomView(c.viewRef.current, c.settings.projection, { width: w, height: h }, factor, w / 2, h / 2)
    void hapticTick()
  }

  return (
    <div data-sky-root className="relative h-full overflow-hidden bg-bg-primary">
      {isAr && <ArVideo videoRef={ar.videoRef} boost={ar.boost} redNight={theme === 'red-night'} />}
      {engine ? (
        <SkyCanvas
          engine={engine}
          canvasRef={ar.canvasRef}
          projection={isAr ? 'gnomonic' : c.settings.projection}
          panEnabled={c.settings.mode === 'touch' || (isAr && !sensorsLive)}
          transparent={isAr}
          fovLimits={isAr ? AR_FOV_LIMITS : null}
          onCalibrate={isAr && sensorsLive ? ar.calibrate : null}
          viewRef={c.viewRef}
          settings={c.settings}
          selected={c.selected}
          target={c.target}
          onTap={(ref) => {
            c.setSelected(ref)
            if (ref) void hapticLock()
          }}
          onUserMove={c.cancelAnimation}
          onGuidanceEvent={onGuidanceEvent}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-secondary" role="status">Chargement du catalogue d’étoiles…</div>
      )}
      <SkyTopBar
        mode={c.settings.mode}
        sensorStatus={sensors.status}
        projection={c.settings.projection}
        immersive={immersive}
        onMode={setMode}
        onProjection={(projection) => c.updateSettings({ projection })}
        onLayers={() => {
          setLayersOpen(true)
          void hapticSelection()
        }}
        onImmersive={() => {
          setImmersive(!immersive)
          void hapticSelection()
        }}
      />
      <SkyZoomControls onZoom={zoom} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2 px-3 ${immersive ? 'pb-[max(env(safe-area-inset-bottom),12px)]' : 'pb-16'}`}>
        {notice && (
          <p data-sky-hud className="mx-auto w-fit rounded-full bg-elevated/90 px-3 py-1.5 text-[12px] text-fair backdrop-blur-md" role="alert">
            {notice}
          </p>
        )}
        {isAr && <ArCameraAlert status={ar.camera.status} onSensors={() => setMode('sensors')} onRetry={ar.camera.retry} />}
        {!c.selected && <SkyTelemetryBadge readout={c.readout} />}
        {isAr && ar.camera.status === 'active' && (
          <ArToolbar
            offsetDeg={ar.offsetDeg}
            calibrating={sensorsLive}
            boost={ar.boost}
            busy={ar.busy}
            onResetOffset={ar.resetOffset}
            onToggleBoost={ar.toggleBoost}
            onCapture={() => void ar.capture(theme === 'red-night')}
          />
        )}
        {c.target && <SkyGuidanceBar target={c.target} locked={c.locked} hint={hint} onStop={c.stopGuidance} />}
        {c.selected && (
          <SkyObjectCard
            object={c.selected}
            loc={c.loc}
            guiding={c.target?.key === c.selected.key}
            showCenter={c.settings.mode === 'touch' || (isAr && !sensorsLive)}
            onGuide={() => {
              if (c.target?.key === c.selected!.key) c.stopGuidance()
              else c.startGuidance(c.selected!)
              void hapticLock()
            }}
            onCenter={() => c.centerOn(c.selected!)}
            onCatalog={() => focusInCatalog(c.selected!.key)}
            onClose={() => c.setSelected(null)}
          />
        )}
      </div>
      {ar.preview && <ArSnapshotPreview url={ar.preview.url} name={ar.preview.name} onClose={ar.closePreview} />}
      {layersOpen && (
        <SkyLayersSheet
          layers={c.settings.layers}
          projection={c.settings.projection}
          onChange={(layers) => c.updateSettings({ layers })}
          onProjection={(projection) => c.updateSettings({ projection })}
          onClose={() => setLayersOpen(false)}
        />
      )}
    </div>
  )
}
