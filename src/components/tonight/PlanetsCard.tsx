/** Carte « Planètes » : graphique de hauteur de la nuit + tableau des éphémérides. */
import { Orbit } from 'lucide-react'
import { useMemo } from 'react'
import type { NightData } from '../../hooks/useNightData'
import { useTheme } from '../../hooks/useAppContext'
import { PLANETS, azimuthToCardinal } from '../../services/astroEngine'
import { Card } from '../ui/Card'
import { fmtMag, fmtNumber, fmtTime } from '../ui/format'
import { AltitudeChart, type AltitudeSeries } from './AltitudeChart'

/** Colonnes : Astre · Pos. (hauteur + azimut cardinal) · Mag · Lever · Coucher. */
const COLS = 'grid grid-cols-[minmax(0,1fr)_68px_40px_46px_52px] gap-1.5'

export function PlanetsCard({ data }: { data: NightData }) {
  const { palette: p } = useTheme()
  const { summary, curves, now } = data

  const series = useMemo<AltitudeSeries[]>(
    () => [
      { id: 'Moon', label: 'Lune', color: p.bodies.Moon, samples: curves.Moon, emphasis: true },
      ...PLANETS.filter((id) => id !== 'Uranus' && id !== 'Neptune').map((id) => {
        const body = summary.bodies.find((b) => b.id === id)!
        return { id, label: body.nameFr, color: p.bodies[id], samples: curves[id], magnitude: body.magnitude }
      }),
    ],
    [curves, p, summary.bodies],
  )

  const rows = summary.bodies.filter((b) => b.id !== 'Sun')

  return (
    <Card title="Système solaire" icon={<Orbit size={15} />}>
      <AltitudeChart series={series} sun={curves.Sun} nowMs={now.getTime()} ariaLabel="Hauteur de la Lune et des planètes de midi à midi" />
      <div className="mt-5" role="table" aria-label="Éphémérides des planètes">
        <div role="row" className={`${COLS} border-b border-hairline pb-1.5 text-[11px] text-tertiary`}>
          <span role="columnheader">Astre</span>
          <span role="columnheader" className="text-right">Pos.</span>
          <span role="columnheader" className="text-right">Mag</span>
          <span role="columnheader" className="text-right">Lever</span>
          <span role="columnheader" className="text-right">Coucher</span>
        </div>
        {rows.map((b) => {
          const rs = summary.riseSet[b.id]
          const up = b.altitudeDeg > 0
          return (
            <div key={b.id} role="row" className={`${COLS} min-h-12 items-center border-b border-hairline py-1 text-[13px] tabular-nums last:border-0`}>
              <span role="cell" className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: p.bodies[b.id] }} aria-hidden />
                <span className="min-w-0">
                  <span className={`block truncate font-medium ${up ? 'text-primary' : 'text-secondary'}`}>{b.nameFr}</span>
                  <span className="block text-[10px] text-tertiary">{b.constellation} · {fmtNumber(b.angularDiameterArcsec, b.angularDiameterArcsec < 100 ? 1 : 0)}″</span>
                </span>
              </span>
              <span role="cell" className={`text-right whitespace-nowrap ${up ? 'text-accent' : 'text-tertiary'}`}>
                {fmtNumber(b.altitudeDeg, 0)}° <span className={up ? 'text-secondary' : 'text-tertiary'}>{azimuthToCardinal(b.azimuthDeg)}</span>
              </span>
              <span role="cell" className="text-right">{fmtMag(b.magnitude)}</span>
              <span role="cell" className="text-right text-secondary">{rs.alwaysUp ? '∞' : fmtTime(rs.rise)}</span>
              <span role="cell" className="text-right text-secondary">{rs.alwaysDown ? '—' : fmtTime(rs.set)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
