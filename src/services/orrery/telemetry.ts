/**
 * Télémétrie d'un astre du Système Solaire 3D, vue depuis la Terre :
 * distances (Soleil, Terre), magnitude, diamètre apparent, élongation, phase,
 * obliquité, période et temps-lumière. Calculs astronomy-engine :
 * `Illumination`, `Elongation`, `HelioVector`, `HelioState`, `HelioDistance`, `JupiterMoons`,
 * `RotationAxis`, `AngleBetween`, `PlanetOrbitalPeriod`.
 */
import {
  AngleBetween,
  Body,
  C_AUDAY,
  Elongation,
  HelioDistance,
  HelioState,
  HelioVector,
  Illumination,
  JupiterMoons,
  KM_PER_AU,
  MakeTime,
  PlanetOrbitalPeriod,
  RAD2DEG,
  RotateVector,
  Rotation_ECL_EQJ,
  RotationAxis,
  Vector,
  type AstroTime,
} from 'astronomy-engine'
import { BODY_RADIUS_KM, GALILEAN_PERIOD_DAYS, ORRERY_NAME_FR } from '../../data/solarSystemPhysical'
import type { GalileanMoonId, OrreryBodyId, OrreryTelemetry, OrreryVisibility, PlanetId } from '../../types/orrery'
import { engineBody, MOON_KEY } from './positions'

const MINUTES_PER_DAY = 1440
const ECL_TO_EQJ = Rotation_ECL_EQJ()

export function isGalileanMoon(id: OrreryBodyId): id is GalileanMoonId {
  return id === 'Io' || id === 'Europa' || id === 'Ganymede' || id === 'Callisto'
}

/** Diamètre apparent (″) d'un astre de rayon connu à une distance donnée (UA). */
export function angularDiameterArcsec(id: OrreryBodyId, distanceAu: number): number {
  return 2 * Math.atan(BODY_RADIUS_KM[id] / (distanceAu * KM_PER_AU)) * RAD2DEG * 3600
}

/**
 * Obliquité vraie : angle entre le vecteur moment cinétique de rotation et la
 * normale au plan de l'orbite propre (r × v, d'après `HelioState`) ; pour le
 * Soleil, la référence est le pôle de l'écliptique. L'IAU place le pôle « nord »
 * du côté nord du plan invariable : pour un rotateur rétrograde (W décroissant :
 * Vénus, Uranus), le moment cinétique pointe à l'opposé, d'où 180° − angle.
 */
export function axialTiltDeg(id: 'Sun' | PlanetId, t: AstroTime): number {
  const body = engineBody(id)
  const axis = RotationAxis(body, t)
  const later = RotationAxis(body, t.AddDays(1 / 24))
  const dSpin = ((later.spin - axis.spin + 540) % 360) - 180
  const angle = AngleBetween(axis.north, id === 'Sun' ? RotateVector(ECL_TO_EQJ, new Vector(0, 0, 1, t)) : orbitNormal(body, t))
  return dSpin < 0 ? 180 - angle : angle
}

/** Normale (sens direct) au plan de l'orbite héliocentrique osculatrice, en EQJ. */
function orbitNormal(body: Body, t: AstroTime): Vector {
  const s = HelioState(body, t)
  return new Vector(s.y * s.vz - s.z * s.vy, s.z * s.vx - s.x * s.vz, s.x * s.vy - s.y * s.vx, t)
}

function visibilityOf(v: string): OrreryVisibility {
  return v === 'morning' || v === 'evening' ? v : null
}

function base(id: OrreryBodyId): OrreryTelemetry {
  return {
    id,
    nameFr: ORRERY_NAME_FR[id],
    kind: id === 'Sun' ? 'star' : isGalileanMoon(id) ? 'moon' : 'planet',
    sunDistanceAu: null,
    earthDistanceAu: null,
    magnitude: null,
    angularDiameterArcsec: null,
    elongationDeg: null,
    visibility: null,
    phaseFraction: null,
    phaseAngleDeg: null,
    axialTiltDeg: null,
    orbitalPeriodDays: null,
    lightTimeMin: null,
    ringTiltDeg: null,
    jupiterSeparationArcsec: null,
  }
}

const lightTime = (au: number) => (au / C_AUDAY) * MINUTES_PER_DAY

function sunTelemetry(t: AstroTime): OrreryTelemetry {
  const d = HelioDistance(Body.Earth, t)
  return {
    ...base('Sun'),
    earthDistanceAu: d,
    magnitude: Illumination(Body.Sun, t).mag,
    angularDiameterArcsec: angularDiameterArcsec('Sun', d),
    axialTiltDeg: axialTiltDeg('Sun', t),
    lightTimeMin: lightTime(d),
  }
}

function earthTelemetry(t: AstroTime): OrreryTelemetry {
  return {
    ...base('Earth'),
    sunDistanceAu: HelioDistance(Body.Earth, t),
    axialTiltDeg: axialTiltDeg('Earth', t),
    orbitalPeriodDays: PlanetOrbitalPeriod(Body.Earth),
  }
}

function planetTelemetry(id: Exclude<PlanetId, 'Earth'>, t: AstroTime): OrreryTelemetry {
  const body = engineBody(id)
  const illum = Illumination(body, t)
  const elong = Elongation(body, t)
  return {
    ...base(id),
    sunDistanceAu: illum.helio_dist,
    earthDistanceAu: illum.geo_dist,
    magnitude: illum.mag,
    angularDiameterArcsec: angularDiameterArcsec(id, illum.geo_dist),
    elongationDeg: elong.elongation,
    visibility: visibilityOf(elong.visibility),
    phaseFraction: illum.phase_fraction,
    phaseAngleDeg: illum.phase_angle,
    axialTiltDeg: axialTiltDeg(id, t),
    orbitalPeriodDays: PlanetOrbitalPeriod(body),
    lightTimeMin: lightTime(illum.geo_dist),
    ringTiltDeg: id === 'Saturn' && illum.ring_tilt !== undefined ? Math.abs(illum.ring_tilt) : null,
  }
}

/**
 * Lunes galiléennes : vecteurs héliocentriques réels (Jupiter + `JupiterMoons`),
 * géocentriques par différence avec la Terre (géométrie instantanée, sans
 * correction de temps-lumière, cohérente avec la scène). Magnitude non modélisée.
 */
function moonTelemetry(id: GalileanMoonId, t: AstroTime): OrreryTelemetry {
  const jup = HelioVector(Body.Jupiter, t)
  const earth = HelioVector(Body.Earth, t)
  const s = JupiterMoons(t)[MOON_KEY[id]]
  const helio = new Vector(jup.x + s.x, jup.y + s.y, jup.z + s.z, t)
  const geo = new Vector(helio.x - earth.x, helio.y - earth.y, helio.z - earth.z, t)
  const jupGeo = new Vector(jup.x - earth.x, jup.y - earth.y, jup.z - earth.z, t)
  const sunFromEarth = new Vector(-earth.x, -earth.y, -earth.z, t)
  const sunFromMoon = new Vector(-helio.x, -helio.y, -helio.z, t)
  const earthFromMoon = new Vector(-geo.x, -geo.y, -geo.z, t)
  const phaseAngleDeg = AngleBetween(sunFromMoon, earthFromMoon)
  const earthDistanceAu = geo.Length()
  return {
    ...base(id),
    sunDistanceAu: helio.Length(),
    earthDistanceAu,
    angularDiameterArcsec: angularDiameterArcsec(id, earthDistanceAu),
    elongationDeg: AngleBetween(geo, sunFromEarth),
    visibility: visibilityOf(Elongation(Body.Jupiter, t).visibility),
    phaseAngleDeg,
    // Fraction illuminée d'une sphère : (1 + cos α) / 2 (même définition qu'astronomy-engine).
    phaseFraction: (1 + Math.cos(phaseAngleDeg / RAD2DEG)) / 2,
    orbitalPeriodDays: GALILEAN_PERIOD_DAYS[id],
    lightTimeMin: lightTime(earthDistanceAu),
    jupiterSeparationArcsec: AngleBetween(geo, jupGeo) * 3600,
  }
}

/** Télémétrie complète d'un astre à l'instant `date`. */
export function getOrreryTelemetry(id: OrreryBodyId, date: Date): OrreryTelemetry {
  const t = MakeTime(date)
  if (id === 'Sun') return sunTelemetry(t)
  if (id === 'Earth') return earthTelemetry(t)
  if (isGalileanMoon(id)) return moonTelemetry(id, t)
  return planetTelemetry(id, t)
}
