/**
 * Positions instantanées du Soleil, de la Lune et des planètes.
 * Toute la mécanique céleste est déléguée à astronomy-engine.
 */
import {
  AngleFromSun,
  Body,
  Constellation,
  Equator,
  Horizon,
  Illumination,
  KM_PER_AU,
  Observer,
  RAD2DEG,
} from 'astronomy-engine'
import type { BodyEphemeris, ObserverLocation, SolarSystemBodyId } from '../../types/astro'

export const SOLAR_SYSTEM_BODIES: readonly SolarSystemBodyId[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

export const PLANETS: readonly SolarSystemBodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']

export const BODY_NAME_FR: Readonly<Record<SolarSystemBodyId, string>> = {
  Sun: 'Soleil', Moon: 'Lune', Mercury: 'Mercure', Venus: 'Vénus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturne', Uranus: 'Uranus', Neptune: 'Neptune',
}

/** Rayons équatoriaux IAU/WGCCRE 2015, en km (diamètre apparent). */
const EQUATORIAL_RADIUS_KM: Readonly<Record<SolarSystemBodyId, number>> = {
  Sun: 695_700, Moon: 1_737.4, Mercury: 2_440.5, Venus: 6_051.8, Mars: 3_396.2,
  Jupiter: 71_492, Saturn: 60_268, Uranus: 25_559, Neptune: 24_764,
}

export function toEngineBody(id: SolarSystemBodyId): Body {
  return Body[id]
}

/** Convertit une position applicative en `Observer` astronomy-engine. */
export function toObserver(loc: ObserverLocation): Observer {
  return new Observer(loc.latitudeDeg, loc.longitudeDeg, loc.elevationM)
}

/** Diamètre apparent en secondes d'arc pour une distance donnée. */
export function angularDiameterArcsec(id: SolarSystemBodyId, distanceAu: number): number {
  const distanceKm = distanceAu * KM_PER_AU
  return 2 * Math.atan(EQUATORIAL_RADIUS_KM[id] / distanceKm) * RAD2DEG * 3600
}

/**
 * Éphéméride topocentrique complète d'un astre du système solaire.
 * Coordonnées apparentes de la date, aberration et réfraction normale incluses.
 */
export function getBodyEphemeris(id: SolarSystemBodyId, date: Date, loc: ObserverLocation): BodyEphemeris {
  const body = toEngineBody(id)
  const observer = toObserver(loc)
  const ofDate = Equator(body, date, observer, true, true)
  const j2000 = Equator(body, date, observer, false, true)
  const hor = Horizon(date, observer, ofDate.ra, ofDate.dec, 'normal')
  const illum = Illumination(body, date)
  return {
    id,
    nameFr: BODY_NAME_FR[id],
    raHours: ofDate.ra,
    decDeg: ofDate.dec,
    distanceAu: ofDate.dist,
    azimuthDeg: hor.azimuth,
    altitudeDeg: hor.altitude,
    magnitude: illum.mag,
    illuminatedFraction: illum.phase_fraction,
    elongationDeg: id === 'Sun' ? 0 : AngleFromSun(body, date),
    angularDiameterArcsec: angularDiameterArcsec(id, ofDate.dist),
    constellation: Constellation(j2000.ra, j2000.dec).symbol,
  }
}

/** Éphémérides de tous les astres du système solaire, dans l'ordre canonique. */
export function getSolarSystemEphemerides(date: Date, loc: ObserverLocation): BodyEphemeris[] {
  return SOLAR_SYSTEM_BODIES.map((id) => getBodyEphemeris(id, date, loc))
}

/** Position horizontale seule (plus léger que l'éphéméride complète, pour les courbes). */
export function getBodyHorizontal(id: SolarSystemBodyId, date: Date, loc: ObserverLocation) {
  const observer = toObserver(loc)
  const eq = Equator(toEngineBody(id), date, observer, true, true)
  const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal')
  return { azimuthDeg: hor.azimuth, altitudeDeg: hor.altitude }
}

/**
 * Hauteur **géométrique** (sans réfraction) du centre du Soleil, en degrés.
 * Les crépuscules (−6°, −12°, −18°) et le seuil de lever/coucher conventionnel
 * (−0,833°) sont définis en hauteur géométrique, comme `SearchAltitude` : comparer
 * une hauteur réfractée à ces seuils décalerait les phases d'environ 0,5°
 * (≈ 3 min sous nos latitudes, bien davantage près des pôles).
 */
export function getSunGeometricAltitudeDeg(date: Date, loc: ObserverLocation): number {
  const observer = toObserver(loc)
  const eq = Equator(Body.Sun, date, observer, true, true)
  return Horizon(date, observer, eq.ra, eq.dec).altitude
}

/**
 * Coordonnées équatoriales topocentriques J2000 (aberration incluse), en degrés :
 * même repère que les catalogues, pour superposer un astre mobile aux objets fixes.
 */
export function getBodyEquatorJ2000(id: SolarSystemBodyId, date: Date, loc: ObserverLocation): { raDeg: number; decDeg: number } {
  const eq = Equator(toEngineBody(id), date, toObserver(loc), false, true)
  return { raDeg: eq.ra * 15, decDeg: eq.dec }
}
