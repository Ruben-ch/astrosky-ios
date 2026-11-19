/**
 * Résolution des objets du planétarium : clé partagée avec le Catalogue →
 * référence typée, et direction horizontale ENU à un instant donné.
 * Astres mobiles : astronomy-engine (Equator + Horizon via getBodyHorizontal).
 */
import { BRIGHT_STARS, DEEP_SKY_CATALOG } from '../../data'
import type { ObserverLocation, SolarSystemBodyId } from '../../types/astro'
import type { SkyObjectRef, Vec3 } from '../../types/sky'
import { BODY_NAME_FR, SOLAR_SYSTEM_BODIES, getBodyEphemeris, getBodyHorizontal } from '../astro/bodies'
import { satelliteDisplayName } from '../satellite/brightCatalog'
import { findTleRecord, isTleValidAt } from '../satellite/tle'
import { propagateRaw } from '../satelliteTracker'
import { eqjVector, transformVector, type Mat3 } from './skyFrame'
import { fromHorizontal } from './vector'

export function isBodyKey(key: string): key is SolarSystemBodyId {
  return (SOLAR_SYSTEM_BODIES as readonly string[]).includes(key)
}

export function deepSkyRef(o: (typeof DEEP_SKY_CATALOG)[number]): SkyObjectRef {
  const code = o.messier !== null ? `M${o.messier}` : (o.ngc ?? o.id)
  return {
    key: o.id, kind: 'deep-sky', label: o.name ? `${code} · ${o.name}` : code, magnitude: o.mag,
    raDeg: o.raDeg, decDeg: o.decDeg, bodyId: null, deepSkyType: o.type,
  }
}

export function bodyRef(id: SolarSystemBodyId, date: Date, loc: ObserverLocation): SkyObjectRef {
  const e = getBodyEphemeris(id, date, loc)
  return {
    key: id, kind: id === 'Moon' ? 'moon' : id === 'Sun' ? 'sun' : 'planet', label: BODY_NAME_FR[id],
    magnitude: e.magnitude, raDeg: e.raHours * 15, decDeg: e.decDeg, bodyId: id, deepSkyType: null,
  }
}

export function starRef(hip: number, raDeg: number, decDeg: number, mag: number, name: string | null): SkyObjectRef {
  return { key: `HIP${hip}`, kind: 'star', label: name ?? `HIP ${hip}`, magnitude: mag, raDeg, decDeg, bodyId: null, deepSkyType: null }
}

/** Clé partagée d'un satellite artificiel. */
export const satelliteKey = (noradId: number) => `SAT${noradId}`

/** Référence d'un satellite dont les éléments orbitaux sont connus (jeu chargé ou embarqué). */
export function satelliteRef(noradId: number): SkyObjectRef | null {
  const record = findTleRecord(noradId)
  if (!record) return null
  return { key: satelliteKey(noradId), kind: 'satellite', label: satelliteDisplayName(record), magnitude: null, raDeg: 0, decDeg: 0, bodyId: null, deepSkyType: null, noradId }
}

/** Référence d'un objet à partir de sa clé Catalogue, ou `null` si inconnue. */
export function resolveSkyObject(key: string, date: Date, loc: ObserverLocation): SkyObjectRef | null {
  if (isBodyKey(key)) return bodyRef(key, date, loc)
  const sat = /^SAT(\d+)$/.exec(key)
  if (sat) return satelliteRef(Number(sat[1]))
  if (key.startsWith('HIP')) {
    const s = BRIGHT_STARS.find((b) => `HIP${b.hip}` === key)
    return s ? starRef(s.hip, s.raDeg, s.decDeg, s.mag, s.name ?? s.designation) : null
  }
  const o = DEEP_SKY_CATALOG.find((d) => d.id === key)
  return o ? deepSkyRef(o) : null
}

/**
 * Satellite dont la position à `date` est masquée : éléments inconnus ou instant
 * hors de la fenêtre de validité TLE (±30 j). Toujours `false` pour un astre.
 */
export function isSatelliteUnavailable(ref: SkyObjectRef, date: Date): boolean {
  if (ref.noradId == null) return false
  const record = findTleRecord(ref.noradId)
  return !record || !isTleValidAt(record, date)
}

/** Direction ENU (réfraction incluse) d'un objet à l'instant `date`. */
export function objectDirection(ref: SkyObjectRef, date: Date, loc: ObserverLocation, m: Mat3): Vec3 {
  if (ref.noradId != null) {
    const record = findTleRecord(ref.noradId)
    const raw = record ? propagateRaw(record, date, loc) : null
    return raw ? fromHorizontal(raw.azimuthDeg, raw.elevationDeg) : fromHorizontal(0, -90)
  }
  if (ref.bodyId) {
    const h = getBodyHorizontal(ref.bodyId, date, loc)
    return fromHorizontal(h.azimuthDeg, h.altitudeDeg)
  }
  return transformVector(m, eqjVector(ref.raDeg, ref.decDeg))
}
