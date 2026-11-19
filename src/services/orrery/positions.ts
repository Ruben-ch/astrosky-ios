/**
 * Positions instantanées du Système Solaire 3D, entièrement issues
 * d'astronomy-engine :
 * - planètes : `HelioVector` (VSOP87, EQJ héliocentrique) ;
 * - lunes galiléennes : `JupiterMoons` (E5 de Lieske, EQJ jovicentrique) ;
 * - axes de rotation : `RotationAxis` (IAU/WGCCRE 2015).
 * Tout est tourné vers l'écliptique J2000 par `Rotation_EQJ_ECL`, puis placé dans
 * la scène par l'échelle visuelle (`visualScale`).
 */
import { Body, HelioVector, JupiterMoons, MakeTime, RotateVector, Rotation_EQJ_ECL, RotationAxis, Vector, type AstroTime } from 'astronomy-engine'
import { GALILEAN_MOONS, ORRERY_PLANETS } from '../../data/solarSystemPhysical'
import type { GalileanMoonId, OrreryBodyId, OrreryBodyState, OrrerySnapshot, PlanetId, Vec3 } from '../../types/orrery'
import { eclToSceneAxes, helioEclToScene, jovicentricEclToScene } from './visualScale'

const EQJ_TO_ECL = Rotation_EQJ_ECL()

/** Vecteur EQJ (UA ou unitaire) → écliptique J2000. */
export function eqjToEcl(x: number, y: number, z: number, t: AstroTime): Vec3 {
  const v = RotateVector(EQJ_TO_ECL, new Vector(x, y, z, t))
  return [v.x, v.y, v.z]
}

export function engineBody(id: 'Sun' | PlanetId): Body {
  return Body[id]
}

/** Clé du résultat de `JupiterMoons` pour une lune galiléenne. */
export const MOON_KEY: Readonly<Record<GalileanMoonId, 'io' | 'europa' | 'ganymede' | 'callisto'>> = {
  Io: 'io', Europa: 'europa', Ganymede: 'ganymede', Callisto: 'callisto',
}

function axisOf(id: 'Sun' | PlanetId, t: AstroTime): { northScene: Vec3; spinDeg: number } {
  const axis = RotationAxis(engineBody(id), t)
  return { northScene: eclToSceneAxes(eqjToEcl(axis.north.x, axis.north.y, axis.north.z, t)), spinDeg: axis.spin }
}

/** Positions héliocentriques et orientations de tous les astres de la scène. */
export function computeOrrerySnapshot(date: Date): OrrerySnapshot {
  const t = MakeTime(date)
  const bodies = {} as Record<OrreryBodyId, OrreryBodyState>
  bodies.Sun = { id: 'Sun', helioEclAu: [0, 0, 0], scene: [0, 0, 0], ...axisOf('Sun', t) }

  for (const id of ORRERY_PLANETS) {
    const h = HelioVector(engineBody(id), t)
    const ecl = eqjToEcl(h.x, h.y, h.z, t)
    bodies[id] = { id, helioEclAu: ecl, scene: helioEclToScene(ecl), ...axisOf(id, t) }
  }

  // Lunes galiléennes : positions réelles autour de Jupiter ; en rotation synchrone,
  // leur axe est assimilé à celui de Jupiter (orbites quasi équatoriales, i < 0,5°).
  const jup = bodies.Jupiter
  const moons = JupiterMoons(t)
  for (const id of GALILEAN_MOONS) {
    const s = moons[MOON_KEY[id]]
    const offset = eqjToEcl(s.x, s.y, s.z, t)
    const sceneOffset = jovicentricEclToScene(offset)
    bodies[id] = {
      id,
      helioEclAu: [jup.helioEclAu[0] + offset[0], jup.helioEclAu[1] + offset[1], jup.helioEclAu[2] + offset[2]],
      scene: [jup.scene[0] + sceneOffset[0], jup.scene[1] + sceneOffset[1], jup.scene[2] + sceneOffset[2]],
      northScene: jup.northScene,
      // Face synchrone : le méridien origine regarde Jupiter.
      spinDeg: (Math.atan2(-sceneOffset[0], -sceneOffset[2]) * 180) / Math.PI,
    }
  }
  return { timeMs: date.getTime(), bodies }
}
