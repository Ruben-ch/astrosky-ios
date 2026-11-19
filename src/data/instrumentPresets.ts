/**
 * Préréglages d'instruments du simulateur de champ : formules optiques courantes
 * du commerce (diamètre / focale nominaux), oculaires usuels et formats de
 * capteurs normalisés (dimensions de la zone sensible, en mm).
 */
import type { BarlowFactor, EyepieceSpec, SensorPreset, TelescopeKind, TelescopePreset } from '../types/fov'

export const TELESCOPE_KIND_LABEL_FR: Readonly<Record<TelescopeKind, string>> = {
  refractor: 'Lunette',
  newtonian: 'Newton',
  sct: 'Schmidt-Cassegrain',
  maksutov: 'Maksutov',
  custom: 'Personnalisé',
}

export const TELESCOPE_PRESETS: readonly TelescopePreset[] = [
  { id: 'refractor-80-480', kind: 'refractor', labelFr: 'Lunette 80/480', apertureMm: 80, focalLengthMm: 480 },
  { id: 'refractor-102-714', kind: 'refractor', labelFr: 'Lunette 102/714', apertureMm: 102, focalLengthMm: 714 },
  { id: 'refractor-120-840', kind: 'refractor', labelFr: 'Lunette apo 120/840', apertureMm: 120, focalLengthMm: 840 },
  { id: 'newton-150-750', kind: 'newtonian', labelFr: 'Newton 150/750', apertureMm: 150, focalLengthMm: 750 },
  { id: 'newton-200-1000', kind: 'newtonian', labelFr: 'Newton 200/1000', apertureMm: 200, focalLengthMm: 1000 },
  { id: 'dobson-254-1200', kind: 'newtonian', labelFr: 'Dobson 254/1200', apertureMm: 254, focalLengthMm: 1200 },
  { id: 'dobson-305-1500', kind: 'newtonian', labelFr: 'Dobson 305/1500', apertureMm: 305, focalLengthMm: 1500 },
  { id: 'sct-127-1250', kind: 'sct', labelFr: 'Schmidt-Cassegrain 127/1250', apertureMm: 127, focalLengthMm: 1250 },
  { id: 'sct-203-2032', kind: 'sct', labelFr: 'Schmidt-Cassegrain 203/2032', apertureMm: 203, focalLengthMm: 2032 },
  { id: 'sct-279-2800', kind: 'sct', labelFr: 'Schmidt-Cassegrain 279/2800', apertureMm: 279, focalLengthMm: 2800 },
  { id: 'mak-127-1500', kind: 'maksutov', labelFr: 'Maksutov 127/1500', apertureMm: 127, focalLengthMm: 1500 },
]

export const EYEPIECE_PRESETS: readonly (EyepieceSpec & { readonly labelFr: string })[] = [
  { focalLengthMm: 40, apparentFieldDeg: 43, labelFr: 'Plössl 40 mm' },
  { focalLengthMm: 32, apparentFieldDeg: 52, labelFr: 'Plössl 32 mm' },
  { focalLengthMm: 25, apparentFieldDeg: 52, labelFr: 'Plössl 25 mm' },
  { focalLengthMm: 20, apparentFieldDeg: 68, labelFr: 'Grand champ 20 mm' },
  { focalLengthMm: 15, apparentFieldDeg: 68, labelFr: 'Grand champ 15 mm' },
  { focalLengthMm: 10, apparentFieldDeg: 52, labelFr: 'Plössl 10 mm' },
  { focalLengthMm: 9, apparentFieldDeg: 82, labelFr: 'Ultra grand champ 9 mm' },
  { focalLengthMm: 6, apparentFieldDeg: 82, labelFr: 'Ultra grand champ 6 mm' },
  { focalLengthMm: 4.7, apparentFieldDeg: 82, labelFr: 'Ultra grand champ 4,7 mm' },
]

/** Champs apparents proposés (orthoscopique, Plössl, grand / ultra / extra grand champ). */
export const APPARENT_FIELD_PRESETS_DEG: readonly number[] = [43, 52, 60, 68, 82, 100]

export const BARLOW_FACTORS: readonly BarlowFactor[] = [1, 2, 3]

export const SENSOR_PRESETS: readonly SensorPreset[] = [
  { id: 'full-frame', labelFr: 'Plein format', widthMm: 36, heightMm: 24 },
  { id: 'aps-c', labelFr: 'APS-C', widthMm: 23.5, heightMm: 15.6 },
  { id: 'aps-c-canon', labelFr: 'APS-C Canon', widthMm: 22.3, heightMm: 14.9 },
  { id: 'micro-4-3', labelFr: 'Micro 4/3', widthMm: 17.3, heightMm: 13 },
]

/** Bornes de saisie des valeurs personnalisées. */
export const OPTICS_LIMITS = {
  apertureMm: [30, 1000],
  focalLengthMm: [100, 5000],
  eyepieceMm: [2, 56],
  apparentFieldDeg: [30, 120],
  sensorMm: [4, 60],
} as const
