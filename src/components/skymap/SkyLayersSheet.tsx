/** Feuille des couches du planétarium : interrupteurs et choix de projection. */
import { X } from 'lucide-react'
import { hapticSelection } from '../../services/haptics'
import type { ProjectionKind, SkyLayers } from '../../types/sky'

const ROWS: { key: keyof SkyLayers; label: string; detail: string }[] = [
  { key: 'constellationLines', label: 'Figures des constellations', detail: 'Tracés IAU / Sky & Telescope' },
  { key: 'constellationNames', label: 'Noms des constellations', detail: '88 constellations' },
  { key: 'starNames', label: 'Noms des étoiles', detail: 'Selon le zoom' },
  { key: 'milkyWay', label: 'Voie lactée', detail: 'Isophotes, 5 niveaux' },
  { key: 'deepSky', label: 'Messier & NGC/IC', detail: '160 objets du ciel profond' },
  { key: 'planets', label: 'Soleil, Lune et planètes', detail: 'Phase lunaire orientée' },
  { key: 'ecliptic', label: 'Écliptique', detail: 'Plan de l’orbite terrestre' },
  { key: 'altAzGrid', label: 'Grille altazimutale', detail: 'Pas adapté au champ' },
  { key: 'equatorialGrid', label: 'Grille équatoriale', detail: 'J2000, équateur céleste' },
  { key: 'horizon', label: 'Sol et horizon', detail: 'Graduations d’azimut' },
]

interface Props {
  layers: SkyLayers
  projection: ProjectionKind
  onChange(layers: SkyLayers): void
  onProjection(p: ProjectionKind): void
  onClose(): void
}

export function SkyLayersSheet({ layers, projection, onChange, onProjection, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-bg-primary/60" role="dialog" aria-modal="true" aria-label="Couches de la carte du ciel">
      <button type="button" data-sheet-backdrop className="min-h-11 flex-1" aria-label="Fermer" onClick={onClose} />
      <div className="pb-safe flex max-h-[80%] flex-col rounded-t-[28px] bg-elevated">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-strong" aria-hidden />
        <div className="flex min-h-12 shrink-0 items-center px-4">
          <h2 className="flex-1 text-[17px] font-semibold">Couches</h2>
          <button type="button" onClick={onClose} aria-label="Fermer les couches" className="touch-target -mr-2 flex items-center justify-center text-secondary">
            <X size={20} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1" role="radiogroup" aria-label="Projection">
            {(['stereographic', 'equidistant'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={projection === k}
                onClick={() => {
                  onProjection(k)
                  void hapticSelection()
                }}
                className={`min-h-11 rounded-lg text-[12px] font-semibold ${projection === k ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
              >
                {k === 'stereographic' ? 'Stéréographique' : 'Azimutale équidistante'}
              </button>
            ))}
          </div>
          <ul>
            {ROWS.map((r) => {
              const on = layers[r.key]
              return (
                <li key={r.key} className="border-b border-hairline last:border-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => {
                      onChange({ ...layers, [r.key]: !on })
                      void hapticSelection()
                    }}
                    className="flex min-h-13 w-full items-center gap-3 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{r.label}</span>
                      <span className="block text-[11px] text-secondary">{r.detail}</span>
                    </span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-subtle bg-elevated'}`} aria-hidden>
                      <span className={`absolute top-0.5 size-5.5 rounded-full transition-transform ${on ? 'translate-x-5.5 bg-accent' : 'translate-x-0.5 bg-tertiary'}`} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
