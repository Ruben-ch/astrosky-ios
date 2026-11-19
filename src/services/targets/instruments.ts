/**
 * Profils d'instruments et limites de détection pour le classement des cibles.
 * Photométrie (pas de mécanique céleste) : gain d'ouverture en 5·log10(D/7 mm),
 * brillance de surface moyenne d'une ellipse de grands axes a × b (arcmin).
 */
import type { InstrumentId, InstrumentProfile } from '../../types/tonight'

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentProfile>> = {
  'naked-eye': { id: 'naked-eye', labelFr: 'Œil nu', apertureMm: 7, magnification: 1, fieldDeg: 60, surfaceBrightnessLimit: 22.5 },
  binoculars: { id: 'binoculars', labelFr: 'Jumelles', apertureMm: 50, magnification: 10, fieldDeg: 6.5, surfaceBrightnessLimit: 23.5 },
  telescope: { id: 'telescope', labelFr: 'Télescope', apertureMm: 200, magnification: 100, fieldDeg: 0.8, surfaceBrightnessLimit: 24 },
}

/** Écart entre magnitude stellaire limite et magnitude intégrée limite d'un objet étendu. */
export const EXTENDED_OFFSET: Readonly<Record<InstrumentId, number>> = { 'naked-eye': 0.8, binoculars: 1.5, telescope: 1.5 }

export const INSTRUMENT_ORDER: readonly InstrumentId[] = ['naked-eye', 'binoculars', 'telescope']

/** Magnitude stellaire limite de l'instrument, à partir de la limite à l'œil nu (NELM). */
export function stellarLimitingMagnitude(profile: InstrumentProfile, nakedEyeLimit: number): number {
  return nakedEyeLimit + 5 * Math.log10(profile.apertureMm / 7)
}

/**
 * Brillance de surface moyenne (mag/arcsec²) d'un objet étendu de magnitude
 * intégrée `mag` et de dimensions `majorArcmin` × `minorArcmin`.
 * `null` si la taille est inconnue.
 */
export function surfaceBrightness(mag: number, majorArcmin: number | null, minorArcmin: number | null): number | null {
  if (majorArcmin === null || majorArcmin <= 0) return null
  const minor = minorArcmin !== null && minorArcmin > 0 ? minorArcmin : majorArcmin
  const areaArcsec2 = (Math.PI / 4) * majorArcmin * minor * 3600
  return mag + 2.5 * Math.log10(areaArcsec2)
}

/**
 * Limite de brillance de surface effective : la Lune éclaircit le fond de ciel
 * d'autant de magnitudes qu'elle fait perdre à la NELM (6,5 par ciel noir).
 */
export function effectiveSurfaceLimit(profile: InstrumentProfile, nakedEyeLimit: number): number {
  return profile.surfaceBrightnessLimit - Math.max(0, 6.5 - nakedEyeLimit)
}
