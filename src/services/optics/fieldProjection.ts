/**
 * Projection gnomonique (plan tangent) autour du centre du simulateur de
 * champ — celle d'un oculaire ou d'un capteur au foyer. Géométrie pure sur
 * coordonnées J2000 ; sert à placer les objets et étoiles voisins réels.
 */
import { BRIGHT_STARS } from '../../data'
import type { BrightStar } from '../../types/catalog'
import type { DeepSkyEntry } from '../../types/encyclopedia'
import { DEG } from '../sky/vector'

const RAD_TO_ARCMIN = 60 / DEG

export interface TangentPoint {
  /** Décalage vers l'est, en minutes d'arc. */
  readonly eastArcmin: number
  /** Décalage vers le nord, en minutes d'arc. */
  readonly northArcmin: number
}

/** Coordonnées standard (ξ, η) de (raDeg, decDeg) autour du centre ; `null` si dans l'hémisphère opposé. */
export function gnomonic(centerRaDeg: number, centerDecDeg: number, raDeg: number, decDeg: number): TangentPoint | null {
  const d0 = centerDecDeg * DEG
  const d = decDeg * DEG
  const dRa = (raDeg - centerRaDeg) * DEG
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(dRa)
  if (cosc <= 1e-6) return null
  return {
    eastArcmin: ((Math.cos(d) * Math.sin(dRa)) / cosc) * RAD_TO_ARCMIN,
    northArcmin: ((Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(dRa)) / cosc) * RAD_TO_ARCMIN,
  }
}

export type FieldNeighbor =
  | (TangentPoint & { readonly kind: 'dso'; readonly entry: DeepSkyEntry })
  | (TangentPoint & { readonly kind: 'star'; readonly star: BrightStar })

/**
 * Objets du ciel profond et étoiles brillantes réels situés dans un carré de
 * demi-côté `radiusArcmin` autour du centre (l'objet `excludeId` est exclu).
 */
export function fieldNeighbors(
  centerRaDeg: number,
  centerDecDeg: number,
  radiusArcmin: number,
  entries: readonly DeepSkyEntry[],
  excludeId: string | null,
  stars: readonly BrightStar[] = BRIGHT_STARS,
): FieldNeighbor[] {
  const out: FieldNeighbor[] = []
  const inside = (p: TangentPoint | null, marginArcmin = 0): p is TangentPoint =>
    p !== null && Math.abs(p.eastArcmin) <= radiusArcmin + marginArcmin && Math.abs(p.northArcmin) <= radiusArcmin + marginArcmin
  for (const entry of entries) {
    if (entry.object.id === excludeId) continue
    const p = gnomonic(centerRaDeg, centerDecDeg, entry.object.raDeg, entry.object.decDeg)
    if (inside(p, (entry.object.sizeMajorArcmin ?? 0) / 2)) out.push({ kind: 'dso', entry, ...p })
  }
  for (const star of stars) {
    const p = gnomonic(centerRaDeg, centerDecDeg, star.raDeg, star.decDeg)
    if (inside(p)) out.push({ kind: 'star', star, ...p })
  }
  return out
}
