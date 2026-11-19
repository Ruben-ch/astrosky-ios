/** Saisie manuelle d'un site (degrés décimaux), repliable. */
import { ChevronDown, MapPin } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ObserverLocation } from '../../types/astro'
import type { ResolvedLocation } from '../../types/services'
import { LocationValidationError, validateLocation } from '../../services/locationService'
import { hapticSelection, hapticWarning } from '../../services/haptics'

interface Props {
  location: ResolvedLocation
  onSubmit(loc: ObserverLocation, label: string): Promise<void>
}

const field = 'min-h-11 w-full min-w-0 rounded-2xl bg-softer px-3 text-[15px] tabular-nums outline-none ring-accent focus:ring-1'

export function ManualEntryForm({ location, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [lat, setLat] = useState(location.latitudeDeg.toFixed(4))
  const [lon, setLon] = useState(location.longitudeDeg.toFixed(4))
  const [elev, setElev] = useState(String(Math.round(location.elevationM)))
  const [label, setLabel] = useState(location.source === 'manual' ? location.label : '')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const parse = (s: string) => Number(s.trim().replace(',', '.').replace('−', '-'))
      const valid = validateLocation({ latitudeDeg: parse(lat), longitudeDeg: parse(lon), elevationM: parse(elev) })
      await onSubmit(valid, label.trim() || 'Site manuel')
    } catch (err) {
      setError(err instanceof LocationValidationError ? err.message : 'Coordonnées invalides')
      void hapticWarning()
    }
  }

  return (
    <div className="rounded-[22px] bg-soft">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          void hapticSelection()
        }}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-[13px] font-medium text-secondary"
      >
        <MapPin size={16} className="text-accent" aria-hidden />
        <span className="flex-1">Saisie manuelle des coordonnées</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <form onSubmit={(e) => void submit(e)} className="space-y-2 px-3 pb-3">
          <input className={field} placeholder="Nom du site (ex. Pic du Midi)" aria-label="Nom du site" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Latitude °', value: lat, set: setLat, mode: 'decimal' as const },
              { label: 'Longitude °', value: lon, set: setLon, mode: 'decimal' as const },
              { label: 'Altitude m', value: elev, set: setElev, mode: 'numeric' as const },
            ].map((f) => (
              <label key={f.label} className="min-w-0">
                <span className="block pb-1 text-[10px] tracking-[0.12em] text-tertiary uppercase">{f.label}</span>
                <input className={field} inputMode={f.mode} aria-label={f.label} value={f.value} onChange={(e) => f.set(e.target.value)} />
              </label>
            ))}
          </div>
          {error && <p className="text-[12px] text-poor" role="alert">{error}</p>}
          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-bg-primary active:opacity-80">
            <MapPin size={16} aria-hidden /> Épingler ce site
          </button>
        </form>
      )}
    </div>
  )
}
