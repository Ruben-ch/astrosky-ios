/**
 * Carte « Meilleures cibles ce soir » : classement dynamique (hauteur, éclat,
 * brillance de surface, champ, Lune) filtrable par instrument. Toucher une
 * cible bascule sur le Catalogue et l'y verrouille.
 */
import { Binoculars, Eye, Target, Telescope, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { NightData } from '../../hooks/useNightData'
import { useNavigation } from '../../hooks/useAppContext'
import { hapticSelection } from '../../services/haptics'
import { INSTRUMENTS, INSTRUMENT_ORDER } from '../../services/targets/instruments'
import { rankTargets } from '../../services/targets/rankTargets'
import type { InstrumentId } from '../../types/tonight'
import { Card } from '../ui/Card'
import { TargetRow } from './TargetRow'

const STORAGE_KEY = 'astrosky:instrument'
const ICONS: Record<InstrumentId, LucideIcon> = { 'naked-eye': Eye, binoculars: Binoculars, telescope: Telescope }
const COLLAPSED = 8
const EXPANDED = 15

function readInstrument(): InstrumentId {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY)
    return INSTRUMENT_ORDER.find((i) => i === v) ?? 'binoculars'
  } catch {
    return 'binoculars'
  }
}

export function BestTargetsCard({ data }: { data: NightData }) {
  const { focusInCatalog } = useNavigation()
  const [instrument, setInstrument] = useState<InstrumentId>(readInstrument)
  const [expanded, setExpanded] = useState(false)
  const nightStartMs = data.summary.nightStart.getTime()
  const { loc } = data

  const ranked = useMemo(
    () => rankTargets(new Date(nightStartMs + 43_200_000), loc, { instrument, limit: EXPANDED }),
    [nightStartMs, loc, instrument],
  )

  const choose = (id: InstrumentId) => {
    setInstrument(id)
    void hapticSelection()
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, id)
    } catch {
      /* préférence non persistée */
    }
  }
  const profile = INSTRUMENTS[instrument]
  const shown = ranked.slice(0, expanded ? EXPANDED : COLLAPSED)

  return (
    <Card title="Meilleures cibles ce soir" icon={<Target size={15} />}>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg-primary/60 p-1" role="radiogroup" aria-label="Instrument">
        {INSTRUMENT_ORDER.map((id) => {
          const Icon = ICONS[id]
          const on = id === instrument
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(id)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold ${on ? 'bg-accent-soft text-accent' : 'text-secondary'}`}
            >
              <Icon size={15} aria-hidden /> {INSTRUMENTS[id].labelFr}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] text-tertiary tabular-nums">
        {instrument === 'naked-eye' ? 'Œil adapté à l’obscurité' : `Ø ${profile.apertureMm} mm · ×${profile.magnification} · champ ${profile.fieldDeg.toLocaleString('fr-FR')}°`} · fenêtre de nuit noire
      </p>
      {ranked.length === 0 ? (
        <p className="py-3 text-[13px] text-secondary">Aucune cible suffisamment haute cette nuit pour cet instrument.</p>
      ) : (
        <ul className="mt-1">
          {shown.map((t, i) => (
            <TargetRow key={t.key} target={t} rank={i + 1} onLock={() => focusInCatalog(t.key)} />
          ))}
        </ul>
      )}
      {ranked.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => {
            setExpanded((e) => !e)
            void hapticSelection()
          }}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl bg-softer text-[14px] font-medium text-accent"
        >
          {expanded ? 'Réduire' : `Afficher les ${ranked.length} meilleures`}
        </button>
      )}
    </Card>
  )
}
