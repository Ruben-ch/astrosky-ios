/**
 * Réglages du simulateur : instrument (préréglages lunette / Newton / SC /
 * Maksutov ou personnalisé), oculaire + Barlow + orientation en visuel,
 * capteur + rotation en photo. Défileurs horizontaux de préréglages (data-h-scroll).
 */
import { RotateCw } from 'lucide-react'
import {
  APPARENT_FIELD_PRESETS_DEG,
  BARLOW_FACTORS,
  EYEPIECE_PRESETS,
  OPTICS_LIMITS,
  SENSOR_PRESETS,
  TELESCOPE_KIND_LABEL_FR,
  TELESCOPE_PRESETS,
} from '../../../data/instrumentPresets'
import { hapticSelection } from '../../../services/haptics'
import { normalizeRotation, withSensorPreset, withTelescopePreset } from '../../../services/optics/fovSettings'
import type { FovSettings, ImageOrientation } from '../../../types/fov'
import { Chip, Segmented, Stepper } from '../../ui/Controls'

interface Props {
  settings: FovSettings
  onChange(next: FovSettings): void
}

const ORIENTATIONS: readonly { id: ImageOrientation; label: string; ariaLabel: string }[] = [
  { id: 'sky', label: 'Ciel', ariaLabel: 'Orientation : nord en haut, est à gauche' },
  { id: 'inverted', label: 'Inversée', ariaLabel: 'Orientation : image renversée (Newton)' },
  { id: 'mirrored', label: 'Miroir', ariaLabel: 'Orientation : image en miroir (renvoi coudé)' },
]

const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-h-scroll role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function FovControls({ settings: s, onChange }: Props) {
  const set = (patch: Partial<FovSettings>) => onChange({ ...s, ...patch })
  const eyepieceMatch = (f: number, a: number) => s.eyepiece.focalLengthMm === f && s.eyepiece.apparentFieldDeg === a

  return (
    <div className="space-y-3">
      <section aria-label="Instrument" className="space-y-2">
        <h3 className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Instrument</h3>
        <Scroller label="Préréglages d’instrument">
          {TELESCOPE_PRESETS.map((p) => (
            <Chip key={p.id} role="radio" active={s.telescopeId === p.id} onToggle={() => onChange(withTelescopePreset(s, p.id))}>
              {p.labelFr}
            </Chip>
          ))}
          <Chip role="radio" active={s.telescopeId === 'custom'} onToggle={() => onChange(withTelescopePreset(s, 'custom'))}>
            {TELESCOPE_KIND_LABEL_FR.custom}
          </Chip>
        </Scroller>
        <div className="grid grid-cols-2 gap-2">
          <Stepper
            label="Diamètre" unit="mm" step={1} min={OPTICS_LIMITS.apertureMm[0]} max={OPTICS_LIMITS.apertureMm[1]} value={s.telescope.apertureMm}
            onChange={(v) => onChange({ ...s, telescopeId: 'custom', telescope: { ...s.telescope, kind: 'custom', apertureMm: v } })}
          />
          <Stepper
            label="Focale" unit="mm" step={10} min={OPTICS_LIMITS.focalLengthMm[0]} max={OPTICS_LIMITS.focalLengthMm[1]} value={s.telescope.focalLengthMm}
            onChange={(v) => onChange({ ...s, telescopeId: 'custom', telescope: { ...s.telescope, kind: 'custom', focalLengthMm: v } })}
          />
        </div>
      </section>

      {s.mode === 'visual' ? (
        <section aria-label="Oculaire" className="space-y-2">
          <h3 className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Oculaire</h3>
          <Scroller label="Oculaires usuels">
            {EYEPIECE_PRESETS.map((e) => (
              <Chip
                key={e.labelFr} role="radio" ariaLabel={`Oculaire ${e.labelFr}, champ apparent ${e.apparentFieldDeg}°`}
                active={eyepieceMatch(e.focalLengthMm, e.apparentFieldDeg)}
                onToggle={() => set({ eyepiece: { focalLengthMm: e.focalLengthMm, apparentFieldDeg: e.apparentFieldDeg } })}
              >
                {fr(e.focalLengthMm)} mm · {e.apparentFieldDeg}°
              </Chip>
            ))}
          </Scroller>
          <div className="grid grid-cols-2 gap-2">
            <Stepper
              label="Focale oculaire" unit="mm" step={1} digits={1} min={OPTICS_LIMITS.eyepieceMm[0]} max={OPTICS_LIMITS.eyepieceMm[1]}
              value={s.eyepiece.focalLengthMm} onChange={(v) => set({ eyepiece: { ...s.eyepiece, focalLengthMm: v } })}
            />
            <Stepper
              label="Champ apparent" unit="°" step={1} min={OPTICS_LIMITS.apparentFieldDeg[0]} max={OPTICS_LIMITS.apparentFieldDeg[1]}
              value={s.eyepiece.apparentFieldDeg} onChange={(v) => set({ eyepiece: { ...s.eyepiece, apparentFieldDeg: v } })}
            />
          </div>
          <Scroller label="Champs apparents usuels">
            {APPARENT_FIELD_PRESETS_DEG.map((a) => (
              <Chip key={a} role="radio" ariaLabel={`Champ apparent ${a}°`} active={s.eyepiece.apparentFieldDeg === a} onToggle={() => set({ eyepiece: { ...s.eyepiece, apparentFieldDeg: a } })}>
                {a}°
              </Chip>
            ))}
          </Scroller>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10px] tracking-[0.12em] text-tertiary uppercase">Barlow</div>
              <Segmented label="Lentille de Barlow" value={s.barlow} onChange={(b) => set({ barlow: b })} options={BARLOW_FACTORS.map((b) => ({ id: b, label: `${b}×`, ariaLabel: `Barlow ${b}×` }))} />
            </div>
            <div>
              <div className="mb-1 text-[10px] tracking-[0.12em] text-tertiary uppercase">Image</div>
              <Segmented label="Orientation de l’image" value={s.orientation} onChange={(o) => set({ orientation: o })} options={ORIENTATIONS} />
            </div>
          </div>
        </section>
      ) : (
        <section aria-label="Capteur" className="space-y-2">
          <h3 className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Capteur</h3>
          <Scroller label="Formats de capteur">
            {SENSOR_PRESETS.map((p) => (
              <Chip key={p.id} role="radio" ariaLabel={`Capteur ${p.labelFr} ${fr(p.widthMm)} × ${fr(p.heightMm)} mm`} active={s.sensorId === p.id} onToggle={() => onChange(withSensorPreset(s, p.id))}>
                {p.labelFr}
              </Chip>
            ))}
            <Chip role="radio" active={s.sensorId === 'custom'} onToggle={() => onChange(withSensorPreset(s, 'custom'))}>
              Personnalisé
            </Chip>
          </Scroller>
          <div className="grid grid-cols-2 gap-2">
            <Stepper
              label="Largeur" unit="mm" step={0.1} digits={1} min={OPTICS_LIMITS.sensorMm[0]} max={OPTICS_LIMITS.sensorMm[1]} value={s.sensor.widthMm}
              onChange={(v) => set({ sensorId: 'custom', sensor: { ...s.sensor, widthMm: v } })}
            />
            <Stepper
              label="Hauteur" unit="mm" step={0.1} digits={1} min={OPTICS_LIMITS.sensorMm[0]} max={OPTICS_LIMITS.sensorMm[1]} value={s.sensor.heightMm}
              onChange={(v) => set({ sensorId: 'custom', sensor: { ...s.sensor, heightMm: v } })}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] tracking-[0.12em] text-tertiary uppercase">Rotation du capteur</div>
              <div className="text-[15px] font-medium tabular-nums">{s.sensorRotationDeg}°</div>
            </div>
            {[-15, 15].map((d) => (
              <button
                key={d}
                type="button"
                aria-label={`Tourner le capteur de ${d > 0 ? '+' : '−'}15°`}
                onClick={() => {
                  void hapticSelection()
                  set({ sensorRotationDeg: normalizeRotation(s.sensorRotationDeg + d) })
                }}
                className="flex size-11 items-center justify-center rounded-2xl bg-soft text-secondary"
              >
                <RotateCw size={16} className={d < 0 ? '-scale-x-100' : ''} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
