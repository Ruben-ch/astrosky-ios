/**
 * Optique instrumentale du simulateur de champ (pas de mécanique céleste) :
 * grossissement, pupille de sortie et champ réel en visuel ; champ couvert par
 * un capteur au foyer en photographie ; remplissage du cadre par un objet.
 */
import type { EyepieceSpec, FramingFit, PhotoFov, SensorSpec, TelescopeSpec, VisualFov, FovWarning } from '../../types/fov'

const RAD_TO_DEG = 180 / Math.PI
/** Pupille d'un œil jeune adapté à l'obscurité, en mm. */
export const EYE_PUPIL_MM = 7
/** Pupille de sortie sous laquelle les corps flottants gênent et l'image s'assombrit, en mm. */
const TINY_EXIT_PUPIL_MM = 0.5

/** Champ visuel à l'oculaire avec une Barlow `barlow`× (champ réel ≈ champ apparent / grossissement). */
export function computeVisualFov(telescope: TelescopeSpec, eyepiece: EyepieceSpec, barlow: number): VisualFov {
  const effectiveFocalMm = telescope.focalLengthMm * barlow
  const magnification = effectiveFocalMm / eyepiece.focalLengthMm
  const exitPupilMm = telescope.apertureMm / magnification
  const maxUsefulMagnification = 2 * telescope.apertureMm
  const warnings: FovWarning[] = []
  if (exitPupilMm > EYE_PUPIL_MM) warnings.push('exit-pupil-too-large')
  if (magnification > maxUsefulMagnification) warnings.push('over-magnified')
  else if (exitPupilMm < TINY_EXIT_PUPIL_MM) warnings.push('exit-pupil-tiny')
  return {
    effectiveFocalMm,
    magnification,
    exitPupilMm,
    trueFieldDeg: eyepiece.apparentFieldDeg / magnification,
    focalRatio: effectiveFocalMm / telescope.apertureMm,
    maxUsefulMagnification,
    minUsefulMagnification: telescope.apertureMm / EYE_PUPIL_MM,
    warnings,
  }
}

/** Angle sous-tendu par une longueur `sizeMm` au foyer d'une focale `focalMm`, en degrés. */
export function angularSizeDeg(sizeMm: number, focalMm: number): number {
  return 2 * Math.atan(sizeMm / (2 * focalMm)) * RAD_TO_DEG
}

/** Champ photographique d'un capteur au foyer (Barlow ou réducteur inclus via `barlow`). */
export function computePhotoFov(telescope: TelescopeSpec, sensor: SensorSpec, barlow = 1): PhotoFov {
  const f = telescope.focalLengthMm * barlow
  return {
    widthDeg: angularSizeDeg(sensor.widthMm, f),
    heightDeg: angularSizeDeg(sensor.heightMm, f),
    diagonalDeg: angularSizeDeg(Math.hypot(sensor.widthMm, sensor.heightMm), f),
    focalRatio: f / telescope.apertureMm,
    arcsecPerMm: 206_264.806 / f,
  }
}

/**
 * Remplissage du cadre : grand axe de l'objet rapporté à la plus petite
 * dimension du champ (diamètre du champ visuel ou petit côté du capteur).
 */
export function framingFit(objectArcmin: number | null, fieldMinArcmin: number): FramingFit | null {
  if (objectArcmin === null || objectArcmin <= 0 || fieldMinArcmin <= 0) return null
  const ratio = objectArcmin / fieldMinArcmin
  const verdict: FramingFit['verdict'] =
    ratio < 0.05 ? 'tiny' : ratio < 0.25 ? 'small' : ratio <= 0.75 ? 'good' : ratio <= 1 ? 'tight' : 'overflow'
  return { ratio, verdict }
}

export const FRAMING_LABEL_FR: Readonly<Record<FramingFit['verdict'], string>> = {
  tiny: 'Minuscule dans le champ',
  small: 'Petit dans le champ',
  good: 'Cadrage idéal',
  tight: 'Cadrage serré',
  overflow: 'Déborde du champ',
}

export const FOV_WARNING_FR: Readonly<Record<FovWarning, string>> = {
  'exit-pupil-too-large': 'Pupille de sortie > 7 mm : une partie de la lumière est perdue.',
  'over-magnified': 'Grossissement au-delà de 2 × D : image floue et sombre.',
  'exit-pupil-tiny': 'Pupille de sortie < 0,5 mm : image très sombre, corps flottants visibles.',
}

/**
 * Échelle d'affichage du simulateur : étendue (arcmin) couverte par le canevas
 * pour que le champ occupe ~80 % de la vue, élargie si l'objet le dépasse
 * (jusqu'à 3 × le champ, au-delà l'objet est rogné).
 */
export function viewSpanArcmin(fieldMaxArcmin: number, objectArcmin: number | null): number {
  const base = fieldMaxArcmin * 1.22
  if (objectArcmin === null) return base
  return Math.min(fieldMaxArcmin * 3, Math.max(base, objectArcmin * 1.15))
}
