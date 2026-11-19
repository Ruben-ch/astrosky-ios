/**
 * Fiche détaillée d'une cible verrouillée : position en direct, élévation de
 * la nuit, caractéristiques et échelle lunaire, saison idéale, conseils par
 * instrument, simulateur de champ et envoi vers le planétarium.
 */
import { ChevronLeft, Crosshair, Navigation } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigation, useObserver } from '../../../hooks/useAppContext'
import { useSimTime } from '../../../hooks/useSimTime'
import { azimuthToCardinal, getNightTimeline, observingNightStart, targetHorizontal } from '../../../services/astroEngine'
import { getInstrumentAdvice } from '../../../services/catalog/advice'
import { getNightElevationProfile } from '../../../services/catalog/nightElevation'
import { getSeasonInfo } from '../../../services/catalog/season'
import type { ObserverLocation } from '../../../types/astro'
import { Readout } from '../../ui/Card'
import { fmtNumber } from '../../ui/format'
import { FovSimulator } from '../fov/FovSimulator'
import { AdviceCard } from './AdviceCard'
import { ElevationCard } from './ElevationCard'
import { PhysicalCard } from './PhysicalCard'
import { SeasonCard } from './SeasonCard'
import { bodyEphemeris, detailHeader, detailSkyTarget, fovTarget, physicalFacts, type DetailTarget } from './detailModel'

interface Props {
  target: DetailTarget
  onBack(): void
}

const fmtRa = (raDeg: number) => {
  const h = (((raDeg % 360) + 360) % 360) / 15
  const hh = Math.floor(h)
  const mm = (h - hh) * 60
  return `${hh}h${fmtNumber(mm, 1).padStart(4, '0')}m`
}

export function CatalogDetail({ target, onBack }: Props) {
  const { location } = useObserver()
  const { guideInSky } = useNavigation()
  const { latitudeDeg, longitudeDeg, elevationM } = location
  const loc = useMemo<ObserverLocation>(() => ({ latitudeDeg, longitudeDeg, elevationM }), [latitudeDeg, longitudeDeg, elevationM])
  const now = useSimTime(1000, 60_000)
  const nowMs = now.getTime()

  const sky = useMemo(() => detailSkyTarget(target), [target])
  const eph = useMemo(() => bodyEphemeris(target, new Date(nowMs), loc), [target, nowMs, loc])
  const header = useMemo(() => detailHeader(target, eph), [target, eph])
  const pos = useMemo(() => targetHorizontal(sky, new Date(nowMs), loc), [sky, nowMs, loc])

  // La frise et le profil ne changent qu'avec la nuit d'observation (ou le lieu).
  const nightStartMs = useMemo(() => observingNightStart(new Date(nowMs), loc).getTime(), [nowMs, loc])
  const profile = useMemo(() => {
    const anchor = new Date(nightStartMs + 43_200_000)
    return getNightElevationProfile(sky, anchor, loc, getNightTimeline(anchor, loc))
  }, [sky, nightStartMs, loc])

  const year = now.getUTCFullYear()
  const season = useMemo(
    () => (sky.kind === 'fixed' ? getSeasonInfo(sky.raDeg, sky.decDeg, year, loc) : null),
    [sky, year, loc],
  )
  const advice = useMemo(() => (target.kind === 'dso' ? getInstrumentAdvice(target.entry) : null), [target])
  const physical = physicalFacts(target, eph)
  const fov = useMemo(() => fovTarget(target, header, eph, new Date(nowMs), loc), [target, header, eph, nowMs, loc])
  const up = pos.altitudeDeg > 0

  return (
    <div className="pb-6" data-key={target.key}>
      <div className="sticky top-0 z-10 flex min-h-12 items-center gap-1 border-b border-hairline bg-bg-primary px-1">
        <button type="button" onClick={onBack} aria-label="Retour au catalogue" className="flex min-h-11 min-w-11 items-center gap-0.5 pr-2 text-[15px] text-accent">
          <ChevronLeft size={22} aria-hidden /> Catalogue
        </button>
        <span className="flex-1" />
        <span className="mr-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
          <Crosshair size={13} aria-hidden /> Cible verrouillée
        </span>
      </div>

      <header className="px-4 pt-4">
        <div className="text-[13px] font-semibold text-accent tabular-nums">{header.code}</div>
        <h2 className="text-[26px] leading-tight font-semibold">{header.title}</h2>
        <p className="mt-0.5 text-[13px] text-secondary">{header.subtitle}</p>
        <div className="mt-3 grid grid-cols-4 gap-2 rounded-[22px] bg-soft px-3 py-2.5">
          <Readout label="Hauteur" value={`${fmtNumber(pos.altitudeDeg, 1)}°`} tone={up ? 'text-accent' : 'text-tertiary'} />
          <Readout label="Azimut" value={`${fmtNumber(pos.azimuthDeg, 0)}°`} unit={azimuthToCardinal(pos.azimuthDeg)} />
          <Readout label={header.ofDate ? 'AD date' : 'AD J2000'} value={fmtRa(header.raDeg)} />
          <Readout label="Déc." value={`${header.decDeg >= 0 ? '+' : '−'}${fmtNumber(Math.abs(header.decDeg), 2)}°`} />
        </div>
        <button
          type="button"
          onClick={() => guideInSky(target.key)}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-[14px] font-semibold text-accent active:scale-[0.98]"
        >
          <Navigation size={16} aria-hidden /> Pointer dans le ciel
        </button>
      </header>

      <div className="mt-4 space-y-3 px-4">
        <ElevationCard profile={profile} nowMs={nowMs} label={header.code} />
        <PhysicalCard code={header.code} facts={physical.facts} note={physical.note} main={fov.main} majorArcmin={fov.majorArcmin} />
        {season && <SeasonCard season={season} nowMonth={now.getMonth()} />}
        {advice && <AdviceCard advice={advice} />}
        <FovSimulator target={fov} />
      </div>
    </div>
  )
}
