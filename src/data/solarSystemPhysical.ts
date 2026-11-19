/**
 * Constantes physiques des astres du Système Solaire 3D.
 * Sources : rayons équatoriaux IAU/WGCCRE 2015 (Archinal et al. 2018) ; lunes
 * galiléennes et anneaux de Saturne : NASA/NSSDCA Planetary Fact Sheets
 * (Jovian Satellite Fact Sheet, Saturnian Rings Fact Sheet).
 */
import type { GalileanMoonId, OrreryBodyId, PlanetId } from '../types/orrery'

export const ORRERY_PLANETS: readonly PlanetId[] = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']

export const GALILEAN_MOONS: readonly GalileanMoonId[] = ['Io', 'Europa', 'Ganymede', 'Callisto']

/** Ordre d'affichage (sélecteur d'astres) : Soleil, planètes, puis lunes galiléennes. */
export const ORRERY_BODIES: readonly OrreryBodyId[] = ['Sun', ...ORRERY_PLANETS, ...GALILEAN_MOONS]

export const ORRERY_NAME_FR: Readonly<Record<OrreryBodyId, string>> = {
  Sun: 'Soleil', Mercury: 'Mercure', Venus: 'Vénus', Earth: 'Terre', Mars: 'Mars', Jupiter: 'Jupiter',
  Saturn: 'Saturne', Uranus: 'Uranus', Neptune: 'Neptune', Io: 'Io', Europa: 'Europe', Ganymede: 'Ganymède', Callisto: 'Callisto',
}

/** Rayon équatorial (planètes, Soleil) ou moyen (lunes), en km. */
export const BODY_RADIUS_KM: Readonly<Record<OrreryBodyId, number>> = {
  Sun: 695_700, Mercury: 2_440.53, Venus: 6_051.8, Earth: 6_378.137, Mars: 3_396.19, Jupiter: 71_492,
  Saturn: 60_268, Uranus: 25_559, Neptune: 24_764, Io: 1_821.6, Europa: 1_560.8, Ganymede: 2_634.1, Callisto: 2_410.3,
}

/** Période orbitale sidérale des lunes galiléennes autour de Jupiter, en jours. */
export const GALILEAN_PERIOD_DAYS: Readonly<Record<GalileanMoonId, number>> = {
  Io: 1.769_138, Europa: 3.551_181, Ganymede: 7.154_553, Callisto: 16.689_017,
}

/** Une bande des anneaux principaux de Saturne : rayons (km) et opacité optique relative [0, 1]. */
export interface RingBand {
  readonly name: string
  readonly innerKm: number
  readonly outerKm: number
  readonly opacity: number
}

/** Anneaux C, B, division de Cassini et A (le plan des anneaux est l'équateur de Saturne). */
export const SATURN_RING_BANDS: readonly RingBand[] = [
  { name: 'C', innerKm: 74_658, outerKm: 92_000, opacity: 0.22 },
  { name: 'B', innerKm: 92_000, outerKm: 117_580, opacity: 0.95 },
  { name: 'Cassini', innerKm: 117_580, outerKm: 122_170, opacity: 0.06 },
  { name: 'A', innerKm: 122_170, outerKm: 136_775, opacity: 0.6 },
]
