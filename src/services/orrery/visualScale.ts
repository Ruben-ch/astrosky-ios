/**
 * Échelle visuelle lisible du Système Solaire 3D.
 *
 * Les directions sont exactes (positions astronomy-engine) ; seules les normes
 * sont compressées pour qu'on voie à la fois Mercure et Neptune :
 * - distances héliocentriques : r_scène = `AU_SCALE` · √(r_UA) ;
 * - rayons des astres : R_scène = `EARTH_VISUAL_RADIUS` · √(R / R_Terre) ;
 * - lunes galiléennes : distance jovicentrique (en rayons de Jupiter) compressée
 *   en loi de puissance autour du globe de Jupiter, sans jamais le traverser.
 * Les rapports d'ordre (qui est plus loin, plus gros) sont tous conservés.
 */
import { KM_PER_AU } from 'astronomy-engine'
import { BODY_RADIUS_KM } from '../../data/solarSystemPhysical'
import type { OrreryBodyId, Vec3 } from '../../types/orrery'

/** Unités de scène pour 1 UA (avant compression en racine carrée). */
export const AU_SCALE = 3
/** Rayon de la Terre dans la scène. */
export const EARTH_VISUAL_RADIUS = 0.085
/** Rayon du globe solaire dans la scène (Mercure au périhélie reste à l'extérieur de la couronne). */
export const SUN_VISUAL_RADIUS = 0.62

const MOON_BASE_RJ = 1.6
const MOON_GAIN = 0.5
const MOON_EXPONENT = 0.6

/** Repère ECL (UA) → axes de scène (x, z, −y) : plan écliptique = XZ, nord écliptique = +Y. */
export function eclToSceneAxes(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]]
}

/** Distance héliocentrique (UA) → rayon dans la scène. */
export function compressHelioDistance(distanceAu: number): number {
  return AU_SCALE * Math.sqrt(Math.max(0, distanceAu))
}

/** Position héliocentrique écliptique (UA) → position de scène (direction exacte, norme compressée). */
export function helioEclToScene(eclAu: Vec3): Vec3 {
  const r = Math.hypot(eclAu[0], eclAu[1], eclAu[2])
  if (r === 0) return [0, 0, 0]
  const k = compressHelioDistance(r) / r
  return eclToSceneAxes([eclAu[0] * k, eclAu[1] * k, eclAu[2] * k])
}

/** Rayon visuel d'un astre dans la scène. */
export function visualRadius(id: OrreryBodyId): number {
  if (id === 'Sun') return SUN_VISUAL_RADIUS
  return EARTH_VISUAL_RADIUS * Math.sqrt(BODY_RADIUS_KM[id] / BODY_RADIUS_KM.Earth)
}

/** Distance jovicentrique en rayons de Jupiter → distance de scène depuis le centre de Jupiter. */
export function compressJovicentricDistance(distanceRj: number): number {
  return visualRadius('Jupiter') * (MOON_BASE_RJ + MOON_GAIN * Math.pow(Math.max(0, distanceRj), MOON_EXPONENT))
}

/** Décalage jovicentrique écliptique (UA) → décalage de scène autour de Jupiter. */
export function jovicentricEclToScene(offsetEclAu: Vec3): Vec3 {
  const rAu = Math.hypot(offsetEclAu[0], offsetEclAu[1], offsetEclAu[2])
  if (rAu === 0) return [0, 0, 0]
  const rj = (rAu * KM_PER_AU) / BODY_RADIUS_KM.Jupiter
  const k = compressJovicentricDistance(rj) / rAu
  return eclToSceneAxes([offsetEclAu[0] * k, offsetEclAu[1] * k, offsetEclAu[2] * k])
}
