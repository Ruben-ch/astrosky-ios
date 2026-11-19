/**
 * Sous-écran « Lancements » : prochains tirs mondiaux (Launch Library 2) avec
 * compte à rebours sur l'horloge de simulation, filtre par opérateur, cache
 * hors-ligne 6 h et données embarquées en secours.
 */
import { RefreshCw, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync'
import { useSimTime } from '../../../hooks/useSimTime'
import { hapticSelection } from '../../../services/haptics'
import { loadLaunches, upcomingLaunches } from '../../../services/space/launchLibrary'
import { Badge } from '../../ui/Card'
import { Chip } from '../../ui/Controls'
import { fmtDay, fmtTime } from '../../ui/format'
import { providerShort } from '../spaceFormat'
import { LaunchCard } from './LaunchCard'

const ORIGIN_FR = { network: 'à jour', cache: 'en cache', 'stale-cache': 'cache périmé', bundled: 'données embarquées' } as const

export function LaunchesPanel() {
  const [force, setForce] = useState(0)
  const set = useAsync(() => loadLaunches({ force: force > 0 }), [force])
  const now = useSimTime(250, 1000)
  const nowMs = now.getTime()
  const [provider, setProvider] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const upcoming = useMemo(() => (set.data ? upcomingLaunches(set.data.launches, nowMs) : []), [set.data, nowMs])
  const providers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of upcoming) counts.set(providerShort(l.provider), (counts.get(providerShort(l.provider)) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [upcoming])
  const shown = provider ? upcoming.filter((l) => providerShort(l.provider) === provider) : upcoming
  const [hero, ...rest] = shown
  const offline = set.data?.origin === 'stale-cache' || set.data?.origin === 'bundled'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase">Prochains lancements</h2>
        {set.data && (
          <Badge tone={offline ? 'text-fair' : 'text-secondary'}>
            {offline && <WifiOff size={10} aria-hidden />}
            {ORIGIN_FR[set.data.origin]} · {fmtDay(new Date(set.data.fetchedAt))} {fmtTime(new Date(set.data.fetchedAt))}
          </Badge>
        )}
        <button
          type="button"
          aria-label="Actualiser les lancements"
          disabled={set.loading}
          onClick={() => {
            void hapticSelection()
            setForce((n) => n + 1)
          }}
          className="flex size-11 items-center justify-center rounded-2xl bg-softer text-secondary disabled:opacity-50"
        >
          <RefreshCw size={16} className={set.loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {providers.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-h-scroll role="radiogroup" aria-label="Filtrer par opérateur">
          <Chip role="radio" active={provider === null} onToggle={() => setProvider(null)}>
            Tous <span className="opacity-70">{upcoming.length}</span>
          </Chip>
          {providers.map(([name, n]) => (
            <Chip key={name} role="radio" active={provider === name} onToggle={() => setProvider(provider === name ? null : name)}>
              {name} <span className="opacity-70">{n}</span>
            </Chip>
          ))}
        </div>
      )}

      {set.loading && !set.data ? (
        <div className="h-40 animate-pulse rounded-[22px] bg-soft" aria-label="Chargement des lancements" />
      ) : !hero ? (
        <p className="py-8 text-center text-[13px] text-secondary">
          Aucun lancement connu après le {fmtDay(now)}{offline ? ' dans les données hors-ligne' : ''}.
        </p>
      ) : (
        <>
          <LaunchCard launch={hero} nowMs={nowMs} hero expanded={expanded === hero.id} onToggle={() => setExpanded(expanded === hero.id ? null : hero.id)} />
          <ul className="space-y-2" aria-label="Lancements suivants">
            {rest.map((l) => (
              <li key={l.id}>
                <LaunchCard launch={l} nowMs={nowMs} expanded={expanded === l.id} onToggle={() => setExpanded(expanded === l.id ? null : l.id)} />
              </li>
            ))}
          </ul>
          <p className="pb-2 text-center text-[11px] text-tertiary">Données Launch Library 2 — The Space Devs. Heures locales, NET = « pas avant ».</p>
        </>
      )}
    </div>
  )
}
