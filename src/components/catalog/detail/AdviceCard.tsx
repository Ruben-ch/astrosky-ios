/** Carte « Conseils d'observation » : verdict, grossissement et astuces par instrument. */
import { Binoculars, Eye, Telescope } from 'lucide-react'
import { VERDICT_LABEL_FR } from '../../../services/catalog/advice'
import { INSTRUMENTS } from '../../../services/targets/instruments'
import type { InstrumentAdvice, ObservationVerdict } from '../../../types/encyclopedia'
import type { InstrumentId } from '../../../types/tonight'
import { Card } from '../../ui/Card'

const ICON: Record<InstrumentId, typeof Eye> = { 'naked-eye': Eye, binoculars: Binoculars, telescope: Telescope }
const DETAIL: Record<InstrumentId, string> = { 'naked-eye': 'pupille 7 mm', binoculars: '10×50', telescope: '200 mm' }
const TONE: Record<ObservationVerdict, string> = {
  invisible: 'text-poor border-subtle',
  difficult: 'text-fair border-subtle',
  accessible: 'text-primary border-subtle',
  easy: 'text-good border-subtle',
  showpiece: 'text-accent border-accent',
}

export function AdviceCard({ advice }: { advice: readonly InstrumentAdvice[] }) {
  return (
    <Card title="Conseils d’observation" icon={<Telescope size={14} />}>
      <ul className="space-y-3">
        {advice.map((a) => {
          const Icon = ICON[a.instrument]
          return (
            <li key={a.instrument} className="rounded-2xl bg-soft p-3">
              <div className="flex items-center gap-2">
                <Icon size={16} className="shrink-0 text-accent" aria-hidden />
                <span className="flex-1 text-[14px] font-semibold">
                  {INSTRUMENTS[a.instrument].labelFr} <span className="text-[11px] font-normal text-tertiary">{DETAIL[a.instrument]}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[a.verdict]}`}>{VERDICT_LABEL_FR[a.verdict]}</span>
              </div>
              {a.magnificationRange && a.verdict !== 'invisible' && (
                <div className="mt-1.5 text-[12px] text-secondary tabular-nums">
                  Grossissement conseillé : <span className="text-primary">{a.magnificationRange[0]}× – {a.magnificationRange[1]}×</span>
                </div>
              )}
              <ul className="mt-1.5 space-y-1">
                {a.tips.map((t) => (
                  <li key={t} className="text-[12px] leading-snug text-secondary">{t}</li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[11px] text-tertiary">Estimations pour un ciel de campagne sans Lune (magnitude limite 6,5 à l’œil nu).</p>
    </Card>
  )
}
