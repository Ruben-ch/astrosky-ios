/** Écran « Ce soir » : synthèse complète de la nuit d'observation simulée. */
import { useNightData } from '../../hooks/useNightData'
import { EventsCard, MeteorCard } from './AgendaCards'
import { BestTargetsCard } from './BestTargetsCard'
import { MoonDetailCard } from './MoonDetailCard'
import { PlanetsCard } from './PlanetsCard'
import { TwilightTimelineCard } from './TwilightTimelineCard'
import { WeatherCard } from './WeatherCard'

export function TonightScreen() {
  const data = useNightData()
  return (
    <div className="space-y-5 px-4 pt-2 pb-20">
      <TwilightTimelineCard timeline={data.timeline} now={data.now} />
      <WeatherCard data={data} />
      <BestTargetsCard data={data} />
      <MoonDetailCard moon={data.moon} now={data.now} latitudeDeg={data.loc.latitudeDeg} />
      <PlanetsCard data={data} />
      <MeteorCard data={data} />
      <EventsCard data={data} />
    </div>
  )
}
