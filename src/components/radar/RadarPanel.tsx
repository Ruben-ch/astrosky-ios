/**
 * Sous-écran « Radar » : radar polaire en direct, prochain passage visible
 * (compte à rebours sur l'horloge de simulation), passages sur 48 h et
 * satellites actuellement levés. Moteur SGP4 + repli sur les TLE embarqués.
 */
import { Loader2, Radar, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useNavigation, useObserver, useSimulation } from '../../hooks/useAppContext'
import { useSimTime } from '../../hooks/useSimTime'
import { passBucketOf, useVisiblePasses } from '../../hooks/useVisiblePasses'
import { azimuthToCardinal } from '../../services/astroEngine'
import { hapticLock, hapticSelection } from '../../services/haptics'
import { selectCandidates } from '../../services/satellite/brightCatalog'
import { nextPass } from '../../services/satellite/visiblePasses'
import { TLE_VALIDITY_MESSAGE, isTleValidAt, loadTleSet, tleAgeDays } from '../../services/satelliteTracker'
import { satelliteKey } from '../../services/sky/skyObjects'
import type { ObserverLocation } from '../../types/astro'
import type { VisiblePass } from '../../types/orbital'
import { Badge, Card } from '../ui/Card'
import { fmtMag, fmtNumber } from '../ui/format'
import { OrbitalRadar } from './OrbitalRadar'
import { PassHero } from './PassHero'
import { PassList } from './PassList'
import { passPhase, type PassFilter } from './spaceFormat'
import type { LiveBlip } from './radarDraw'

const ORIGIN_FR = { network: 'à jour', cache: 'cache', 'stale-cache': 'cache périmé', bundled: 'embarqués' } as const

export function RadarPanel() {
  const { location } = useObserver()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  const loc = useMemo<ObserverLocation>(() => ({ latitudeDeg, longitudeDeg, elevationM }), [latitudeDeg, longitudeDeg, elevationM])
  const sim = useSimulation()
  const { guideInSky } = useNavigation()
  const now = useSimTime(250, 1000)
  const nowMs = now.getTime()

  const tle = useAsync(() => loadTleSet(), [])
  const candidates = useMemo(() => (tle.data ? selectCandidates(tle.data) : []), [tle.data])
  const { passes, progress, done } = useVisiblePasses(candidates, passBucketOf(nowMs), loc)
  const [filter, setFilter] = useState<PassFilter>('all')
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null)
  const [blips, setBlips] = useState<readonly LiveBlip[]>([])

  const upcoming = useMemo(() => passes.filter((p) => p.set.time.getTime() >= nowMs - 3_600_000), [passes, nowMs])
  const selected: VisiblePass | null = upcoming.find((p) => p.id === selectedPassId) ?? nextPass(upcoming, nowMs)
  const [liveSatId, setLiveSatId] = useState<number | null>(null)
  const radarSatId = liveSatId ?? selected?.noradId ?? null

  const point = (pass: VisiblePass) => {
    if (passPhase(pass, nowMs) === 'upcoming' || passPhase(pass, nowMs) === 'rising') sim.jumpTo(pass.visibleStart.time.getTime() - 30_000)
    void hapticLock()
    guideInSky(satelliteKey(pass.noradId))
  }
  const origin = tle.data?.origin
  const offline = origin === 'stale-cache' || origin === 'bundled'
  const iss = tle.data?.records.find((r) => r.noradId === 25544)
  // Instant simulé trop éloigné de l'époque des éléments : positions et passages masqués.
  const tleExpired = candidates.length > 0 && candidates.every((c) => !isTleValidAt(c.record, now))

  return (
    <div className="space-y-3">
      <Card
        title="Radar orbital"
        icon={<Radar size={14} />}
        aside={
          tle.data && (
            <Badge tone={offline ? 'text-fair' : 'text-secondary'}>
              {offline && <WifiOff size={10} aria-hidden />}
              TLE {ORIGIN_FR[tle.data.origin]}{iss ? ` · ${fmtNumber(Math.abs(tleAgeDays(iss, now)), 1)} j` : ''}
            </Badge>
          )
        }
      >
        <OrbitalRadar
          candidates={candidates}
          loc={loc}
          pass={selected && (liveSatId === null || liveSatId === selected.noradId) ? selected : null}
          selectedId={radarSatId}
          onBlips={setBlips}
          onSelect={(id) => {
            setLiveSatId(id)
            void hapticSelection()
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-secondary" aria-hidden>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-accent" /> visible</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t border-dashed border-strong" /> ombre</span>
          <span>▲ lever · ✛ culmination · ▼ coucher · ◐ ombre</span>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-secondary tabular-nums" role="status">
          {(!tle.data || (!done && !tleExpired)) && <Loader2 size={12} className="animate-spin" aria-hidden />}
          {!tle.data ? 'Chargement des éléments orbitaux…' : tleExpired ? 'Positions masquées : données TLE hors de leur fenêtre de validité' : done ? `${candidates.length} satellites suivis · ${blips.length} au-dessus de l’horizon` : `Prédiction des passages… ${progress.done}/${progress.total}`}
        </p>
      </Card>

      {selected ? (
        <PassHero pass={selected} nowMs={nowMs} onPoint={() => point(selected)} />
      ) : (
        tle.data && (done || tleExpired) && (
          <Card title="Passages visibles">
            <p className="text-[13px] text-secondary">
              {tleExpired ? `${TLE_VALIDITY_MESSAGE}.` : 'Aucun passage visible dans les 48 heures depuis ce site (nuits trop claires ou satellites dans l’ombre).'}
            </p>
          </Card>
        )
      )}

      {blips.length > 0 && (
        <Card title="Au-dessus de l’horizon" aside={<span className="text-[11px] text-secondary">toucher pour suivre</span>}>
          <ul className="-mx-4 divide-y divide-hairline">
            {[...blips].sort((a, b) => b.elevationDeg - a.elevationDeg).slice(0, 8).map((b) => (
              <li key={b.noradId}>
                <button
                  type="button"
                  onClick={() => {
                    setLiveSatId(b.noradId)
                    void hapticSelection()
                  }}
                  aria-pressed={radarSatId === b.noradId}
                  className={`flex min-h-11 w-full items-center gap-3 px-4 text-left ${radarSatId === b.noradId ? 'bg-elevated' : ''}`}
                >
                  <span className={`size-2 shrink-0 rounded-full ${b.sunlit ? 'bg-accent' : 'bg-strong'}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {b.name} <span className="text-[11px] text-tertiary tabular-nums">{b.noradId}</span>
                  </span>
                  <span className="w-20 text-right text-[12px] text-secondary tabular-nums">{fmtNumber(b.elevationDeg, 0)}° {azimuthToCardinal(b.azimuthDeg)}</span>
                  <span className="w-14 text-right text-[12px] tabular-nums">{b.sunlit && b.magnitude !== null ? fmtMag(b.magnitude) : 'ombre'}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PassList
        passes={upcoming}
        filter={filter}
        onFilter={setFilter}
        selectedId={selected?.id ?? null}
        nowMs={nowMs}
        pending={!tle.data || !done}
        onSelect={(p) => {
          setSelectedPassId(p.id)
          setLiveSatId(null)
          void hapticLock()
        }}
      />
    </div>
  )
}
