/**
 * Onglet « Système » : Système Solaire 3D interactif (Three.js), chargé à la
 * demande (React.lazy). Positions héliocentriques astronomy-engine synchronisées
 * sur l'horloge de simulation, orbite / zoom / double-tap pour centrer,
 * télémétrie détaillée, vues écliptique et polaire, vision nocturne rouge.
 * Paramètre d'URL facultatif : `?body=<Id>` (astre sélectionné et centré à l'ouverture).
 */
import { useEffect, useRef, useState } from 'react'
import { ORRERY_BODIES } from '../../data/solarSystemPhysical'
import { hapticLock, hapticSelection, hapticTick } from '../../services/haptics'
import { DEFAULT_ORRERY_SETTINGS, loadOrrerySettings, saveOrrerySettings } from '../../services/orrery/orrerySettings'
import type { OrreryBodyId, OrrerySettings, OrreryViewMode } from '../../types/orrery'
import { BodyStrip } from './BodyStrip'
import { OrreryCanvas } from './OrreryCanvas'
import type { OrreryEngine } from './orreryEngine'
import { OrreryTopBar, OrreryZoomControls } from './OrreryHud'
import { TelemetryPanel } from './TelemetryPanel'

function initialBody(): OrreryBodyId | null {
  try {
    const b = new URLSearchParams(globalThis.location?.search ?? '').get('body')
    return ORRERY_BODIES.find((id) => id === b) ?? null
  } catch {
    return null
  }
}

export default function OrreryScreen() {
  const engineRef = useRef<OrreryEngine | null>(null)
  const [settings, setSettings] = useState<OrrerySettings>(DEFAULT_ORRERY_SETTINGS)
  const [selected, setSelected] = useState<OrreryBodyId | null>(initialBody)
  const [focused, setFocused] = useState<OrreryBodyId | null>(initialBody)
  const loaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadOrrerySettings().then((s) => {
      if (cancelled) return
      loaded.current = true
      setSettings(s)
      if (s.viewMode !== DEFAULT_ORRERY_SETTINGS.viewMode) engineRef.current?.controller.setViewMode(s.viewMode, performance.now())
    })
    const first = initialBody()
    if (first) engineRef.current?.focusOn(first, performance.now())
    return () => {
      cancelled = true
    }
  }, [])

  const update = (patch: Partial<OrrerySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (loaded.current) void saveOrrerySettings(next)
      return next
    })
  }

  const select = (id: OrreryBodyId | null) => {
    setSelected(id)
    if (id) void hapticLock()
  }

  const focus = (id: OrreryBodyId | null) => {
    const engine = engineRef.current
    if (!engine) return
    if (id) {
      engine.focusOn(id, performance.now())
      setSelected(id)
    } else engine.recenter(performance.now())
    setFocused(id)
    void hapticLock()
  }

  const setViewMode = (mode: OrreryViewMode) => {
    if (mode === settings.viewMode) return
    engineRef.current?.controller.setViewMode(mode, performance.now())
    update({ viewMode: mode })
    void hapticSelection()
  }

  return (
    <div data-orrery-root className="relative h-full overflow-hidden bg-bg-primary">
      <OrreryCanvas
        engineRef={engineRef}
        settings={settings}
        selected={selected}
        onSelect={select}
        onFocus={focus}
        onPinchStep={() => void hapticTick()}
        onViewModeObserved={(viewMode) => update({ viewMode })}
      />
      <OrreryTopBar
        viewMode={settings.viewMode}
        showOrbits={settings.showOrbits}
        showLabels={settings.showLabels}
        follow={settings.follow}
        onViewMode={setViewMode}
        onToggle={(key) => {
          update({ [key]: !settings[key] })
          void hapticSelection()
        }}
        onRecenter={() => focus(null)}
      />
      <OrreryZoomControls
        onZoom={(f) => {
          engineRef.current?.controller.zoom(f)
          void hapticTick()
        }}
      />
      {/* Zone basse bornée sous la barre supérieure : machine temporelle dépliée, le panneau défile au lieu de déborder. */}
      <div className="pointer-events-none absolute inset-x-0 top-16 bottom-0 z-10 flex flex-col justify-end gap-3 px-3 pb-16">
        <div className="shrink-0">
          <BodyStrip selected={selected} focused={focused} onPick={(id) => (id === selected ? focus(id) : select(id))} />
        </div>
        {selected && (
          <div className="no-scrollbar pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-2xl">
            <TelemetryPanel id={selected} focused={focused === selected} onCenter={() => focus(selected)} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  )
}
