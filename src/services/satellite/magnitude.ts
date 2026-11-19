/**
 * Magnitude apparente d'un satellite à partir de sa magnitude standard
 * (1000 km, disque éclairé à 50 %, convention QuickSat / Heavens-Above) :
 *   m = m_std + 5·log10(d / 1000 km) − 2,5·log10(f / 0,5) − 2,5·log10(1 − ombre)
 * où f = (1 + cos φ) / 2 est la fraction éclairée vue par l'observateur et φ
 * l'angle de phase Soleil–satellite–observateur. Géométrie : satellite.js (ECI).
 */
import { ecfToEci, geodeticToEcf, gstime, type EciVec3 } from 'satellite.js'

/** Unité astronomique, en km (sunPos de satellite.js renvoie des UA). */
export const AU_KM = 149_597_870.7

type Vec = { x: number; y: number; z: number }

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const norm = (a: Vec) => Math.hypot(a.x, a.y, a.z)

/** Angle entre deux vecteurs, en degrés. */
export function angleBetweenDeg(a: Vec, b: Vec): number {
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (norm(a) * norm(b))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

/** Position ECI (km) de l'observateur à l'instant `date`. */
export function observerEci(latitudeRad: number, longitudeRad: number, heightKm: number, date: Date): EciVec3<number> {
  return ecfToEci(geodeticToEcf({ latitude: latitudeRad, longitude: longitudeRad, height: heightKm }), gstime(date))
}

/**
 * Angle de phase (degrés) vu du satellite entre le Soleil et l'observateur :
 * 0° = pleine phase (Soleil derrière l'observateur), 180° = contre-jour.
 */
export function phaseAngleDeg(satEciKm: Vec, sunEciAu: Vec, observerEciKm: Vec): number {
  const sunKm = { x: sunEciAu.x * AU_KM, y: sunEciAu.y * AU_KM, z: sunEciAu.z * AU_KM }
  return angleBetweenDeg(sub(sunKm, satEciKm), sub(observerEciKm, satEciKm))
}

/** Fraction du disque éclairée vue par l'observateur pour un angle de phase donné. */
export function illuminatedFraction(phaseDeg: number): number {
  return (1 + Math.cos((phaseDeg * Math.PI) / 180)) / 2
}

/**
 * Magnitude apparente, ou `null` si le satellite est entièrement éclipsé
 * ou vu exactement à contre-jour (aucune face éclairée visible).
 */
export function satelliteMagnitude(stdMag: number, rangeKm: number, phaseDeg: number, shadowFraction = 0): number | null {
  const lit = illuminatedFraction(phaseDeg)
  const sunLight = 1 - Math.min(1, Math.max(0, shadowFraction))
  if (lit <= 1e-4 || sunLight <= 1e-4 || rangeKm <= 0) return null
  return stdMag + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(lit / 0.5) - 2.5 * Math.log10(sunLight)
}
