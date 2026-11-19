/**
 * Projection rapide d'objets fixes (étoiles, ciel profond) J2000 → horizontal.
 * La matrice EQJ→HOR (précession + nutation + rotation terrestre) est calculée
 * une seule fois par instant par astronomy-engine, puis appliquée à chaque objet :
 * idéal pour une boucle de rendu 60 fps sur des centaines d'objets.
 */
import {
  HorizonFromVector,
  RotateVector,
  Rotation_EQJ_HOR,
  Spherical,
  VectorFromSphere,
  type AstroTime,
  MakeTime,
} from 'astronomy-engine'
import type {
  AltitudeSample,
  DeepSkyVisibility,
  HorizontalPosition,
  ObserverLocation,
  SkyTarget,
} from '../../types/astro'
import type { DeepSkyObject } from '../../types/catalog'
import { getBodyHorizontal, toObserver } from './bodies'
import { getDarkWindow } from './riseSet'

export type SkyProjector = (raDeg: number, decDeg: number) => HorizontalPosition

/** Crée un projecteur J2000 → (azimut, hauteur réfractée) figé à l'instant `date`. */
export function createSkyProjector(date: Date, loc: ObserverLocation): SkyProjector {
  const time: AstroTime = MakeTime(date)
  const rotation = Rotation_EQJ_HOR(time, toObserver(loc))
  return (raDeg, decDeg) => {
    const eqj = VectorFromSphere(new Spherical(decDeg, raDeg, 1), time)
    const hor = HorizonFromVector(RotateVector(rotation, eqj), 'normal')
    return { azimuthDeg: hor.lon, altitudeDeg: hor.lat }
  }
}

/** Position horizontale d'une cible quelconque à un instant donné. */
export function targetHorizontal(target: SkyTarget, date: Date, loc: ObserverLocation): HorizontalPosition {
  if (target.kind === 'body') return getBodyHorizontal(target.id, date, loc)
  return createSkyProjector(date, loc)(target.raDeg, target.decDeg)
}

/**
 * Courbe de hauteur échantillonnée régulièrement.
 * @param durationMs durée totale couverte, en millisecondes.
 * @param stepMs pas d'échantillonnage, en millisecondes.
 */
export function getAltitudeCurve(
  target: SkyTarget,
  start: Date,
  durationMs: number,
  stepMs: number,
  loc: ObserverLocation,
): AltitudeSample[] {
  if (stepMs <= 0) throw new RangeError('stepMs doit être strictement positif')
  const samples: AltitudeSample[] = []
  const t0 = start.getTime()
  for (let dt = 0; dt <= durationMs; dt += stepMs) {
    const time = new Date(t0 + dt)
    const hor = targetHorizontal(target, time, loc)
    samples.push({ time, altitudeDeg: hor.altitudeDeg, azimuthDeg: hor.azimuthDeg })
  }
  return samples
}

/**
 * Visibilité nocturne d'une liste d'objets du ciel profond pendant la nuit
 * contenant `date` : hauteur maximale, meilleur instant et durée au-dessus de 30°.
 * Une seule matrice de rotation par pas de temps est partagée entre tous les objets.
 */
export function computeDeepSkyVisibility(
  objects: readonly DeepSkyObject[],
  date: Date,
  loc: ObserverLocation,
  stepMinutes = 10,
): Map<string, DeepSkyVisibility> {
  const { start, end } = getDarkWindow(date, loc)
  const stepMs = stepMinutes * 60_000
  const nowProjector = createSkyProjector(date, loc)
  const acc = objects.map((o) => ({ o, max: -90, best: null as Date | null, above30: 0 }))
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const time = new Date(t)
    const project = createSkyProjector(time, loc)
    for (const a of acc) {
      const alt = project(a.o.raDeg, a.o.decDeg).altitudeDeg
      if (alt > a.max) {
        a.max = alt
        a.best = time
      }
      if (alt >= 30) a.above30 += stepMinutes
    }
  }
  const out = new Map<string, DeepSkyVisibility>()
  for (const a of acc) {
    out.set(a.o.id, {
      id: a.o.id,
      maxAltitudeDeg: a.max,
      bestTime: a.max > 0 ? a.best : null,
      minutesAbove30Deg: a.above30,
      current: nowProjector(a.o.raDeg, a.o.decDeg),
    })
  }
  return out
}

/** Convertit un azimut en point cardinal français sur 16 secteurs. */
export function azimuthToCardinal(azimuthDeg: number): string {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  const idx = Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16
  return names[idx]
}
