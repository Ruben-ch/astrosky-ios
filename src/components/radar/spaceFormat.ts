/**
 * Logique d'affichage partagée de l'onglet Espace (sans composant) : phase d'un
 * passage, filtres, tonalité des statuts de lancement, noms courts d'opérateurs.
 */
import { ISS_NORAD, TIANGONG_NORAD } from '../../services/satellite/brightCatalog'
import type { VisiblePass } from '../../types/orbital'
import type { LaunchStatus } from '../../types/space'

export type PassPhase = 'upcoming' | 'visible' | 'rising' | 'eclipsed' | 'over'

/** Phase du passage à l'instant `nowMs`. */
export function passPhase(p: VisiblePass, nowMs: number): PassPhase {
  if (nowMs > p.set.time.getTime()) return 'over'
  if (nowMs < p.rise.time.getTime()) return 'upcoming'
  if (nowMs < p.visibleStart.time.getTime()) return 'rising'
  if (nowMs <= p.visibleEnd.time.getTime()) return 'visible'
  return 'eclipsed'
}

export type PassFilter = 'all' | 'iss' | 'tiangong' | 'bright'

export function filterPasses(passes: readonly VisiblePass[], f: PassFilter): VisiblePass[] {
  if (f === 'iss') return passes.filter((p) => p.noradId === ISS_NORAD)
  if (f === 'tiangong') return passes.filter((p) => p.noradId === TIANGONG_NORAD)
  if (f === 'bright') return passes.filter((p) => p.noradId !== ISS_NORAD && p.noradId !== TIANGONG_NORAD)
  return [...passes]
}

export const STATUS_TONE: Readonly<Record<LaunchStatus, string>> = {
  go: 'border-good text-good',
  tbc: 'border-fair text-fair',
  tbd: 'border-hairline text-secondary',
  hold: 'border-poor text-poor',
  'in-flight': 'border-accent text-accent',
  success: 'border-good text-good',
  failure: 'border-poor text-poor',
  'partial-failure': 'border-fair text-fair',
  unknown: 'border-hairline text-tertiary',
}

/** Abréviations des opérateurs les plus fréquents (libellés de filtre et de carte). */
export function providerShort(name: string): string {
  if (/China Aerospace Science/i.test(name)) return 'CASC'
  if (/ROSCOSMOS|Russian Federal Space/i.test(name)) return 'Roscosmos'
  if (/Indian Space Research/i.test(name)) return 'ISRO'
  if (/United Launch Alliance/i.test(name)) return 'ULA'
  if (/National Aeronautics and Space/i.test(name)) return 'NASA'
  if (/Japan Aerospace Exploration/i.test(name)) return 'JAXA'
  return name.replace(/\s+(S\.p\.A|Inc\.?|Corporation|GmbH)$/i, '')
}
