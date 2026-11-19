/**
 * Coquille racine d'AstroSky : fournisseurs globaux (thème, horloge de
 * simulation, observateur, navigation), en-tête, écran actif, machine
 * temporelle et barre d'onglets.
 */
import { Library, MoonStar, Orbit, Satellite, Sparkles } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { NavigationProvider } from './context/NavigationContext'
import { ObserverProvider } from './context/ObserverContext'
import { SimulationProvider } from './context/SimulationContext'
import { ThemeProvider } from './context/ThemeContext'
import { CatalogScreen } from './components/catalog/CatalogScreen'
import { LocationSheet } from './components/location/LocationSheet'
import { SpaceScreen } from './components/radar/SpaceScreen'
import { SkyScreen } from './components/skymap/SkyScreen'
import { TimeMachine } from './components/time/TimeMachine'
import { TonightScreen } from './components/tonight/TonightScreen'
import { AppHeader } from './components/ui/AppHeader'
import { TabBar, type TabDef } from './components/ui/TabBar'
import { useNavigation } from './hooks/useAppContext'
import type { TabId } from './types/navigation'

// Three.js (~600 ko) n'est chargé qu'à l'ouverture de l'onglet « Système ».
const OrreryScreen = lazy(() => import('./components/orrery/OrreryScreen'))

const TABS: readonly TabDef<TabId>[] = [
  { id: 'tonight', label: 'Ce soir', icon: MoonStar },
  { id: 'sky', label: 'Ciel', icon: Sparkles },
  { id: 'system', label: 'Système', icon: Orbit },
  { id: 'catalog', label: 'Catalogue', icon: Library },
  { id: 'satellites', label: 'Espace', icon: Satellite },
]

const TITLES: Record<TabId, string> = { tonight: 'Ce soir', sky: 'Ciel', system: 'Système', catalog: 'Catalogue', satellites: 'Espace' }

function initialSimMs(): number | undefined {
  try {
    const t = new URLSearchParams(globalThis.location?.search ?? '').get('t')
    const ms = t ? Date.parse(t) : NaN
    return Number.isFinite(ms) ? ms : undefined
  } catch {
    return undefined
  }
}

function Shell() {
  const { tab, navigate, immersive } = useNavigation()
  const fullscreen = immersive && tab === 'sky'
  const [locationOpen, setLocationOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  return (
    <div className="flex h-full flex-col bg-bg-primary text-primary">
      {/* Vision nocturne des médias distants : luminance (Rec. 709) → canal rouge seul, G = B = 0. */}
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <filter id="astrosky-red-night" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        {/* Caméra AR en vision nocturne : luminance (Rec. 601) → canal rouge seul. */}
        <filter id="astrosky-red-night-video" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
      </svg>
      {!fullscreen && <AppHeader title={TITLES[tab]} onOpenLocation={() => setLocationOpen(true)} />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main
          ref={mainRef}
          className={`no-scrollbar min-h-0 flex-1 overscroll-contain ${tab === 'sky' || tab === 'system' ? 'overflow-hidden' : 'overflow-y-auto'}`}
          key={tab}
        >
          {tab === 'tonight' && <TonightScreen />}
          {tab === 'sky' && <SkyScreen />}
          {tab === 'system' && (
            <Suspense fallback={<p className="flex h-full items-center justify-center text-[13px] text-secondary" role="status">Chargement du système solaire…</p>}>
              <OrreryScreen />
            </Suspense>
          )}
          {tab === 'catalog' && <CatalogScreen />}
          {tab === 'satellites' && <SpaceScreen />}
        </main>
        {/* Pilule flottante : les écrans réservent ~56 px en bas (PILL_CLEARANCE). */}
        {!fullscreen && <TimeMachine />}
      </div>
      {!fullscreen && <TabBar<TabId>
        tabs={TABS}
        active={tab}
        onChange={navigate}
        // Convention iOS : toucher l'onglet actif remonte en haut de l'écran.
        onReselect={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      />}
      {locationOpen && <LocationSheet onClose={() => setLocationOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <SimulationProvider initialMs={initialSimMs()}>
        <ObserverProvider>
          <NavigationProvider>
            <Shell />
          </NavigationProvider>
        </ObserverProvider>
      </SimulationProvider>
    </ThemeProvider>
  )
}
