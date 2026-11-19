/**
 * Onglet « Espace » — Radar orbital & Espace : radar polaire des passages
 * visibles, calendrier des lancements et Image Astronomique du Jour.
 * Sous-écran initial déterministe via `?space=radar|launches|apod`.
 */
import { useState } from 'react'
import { Segmented } from '../ui/Controls'
import { ApodPanel } from './apod/ApodPanel'
import { LaunchesPanel } from './launches/LaunchesPanel'
import { RadarPanel } from './RadarPanel'

export type SpaceView = 'radar' | 'launches' | 'apod'

const VIEWS: readonly { id: SpaceView; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'launches', label: 'Lancements' },
  { id: 'apod', label: 'Image du jour' },
]

function initialView(): SpaceView {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('space')
    return VIEWS.some((x) => x.id === v) ? (v as SpaceView) : 'radar'
  } catch {
    return 'radar'
  }
}

export function SpaceScreen() {
  const [view, setView] = useState<SpaceView>(initialView)
  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 border-b border-hairline bg-bg-primary/95 px-4 pt-1 pb-2.5 backdrop-blur-xl">
        <Segmented<SpaceView> label="Sous-écran Espace" value={view} onChange={setView} options={VIEWS} />
      </div>
      <div className="px-4 pt-4">
        {view === 'radar' && <RadarPanel />}
        {view === 'launches' && <LaunchesPanel />}
        {view === 'apod' && <ApodPanel />}
      </div>
    </div>
  )
}
