/** Configuration du simulateur de champ, validée et persistée hors-ligne. */
import { APPARENT_FIELD_PRESETS_DEG, OPTICS_LIMITS, SENSOR_PRESETS, TELESCOPE_PRESETS } from '../../data/instrumentPresets'
import type { BarlowFactor, FovSettings, ImageOrientation, TelescopeKind } from '../../types/fov'
import { cacheGet, cacheSet } from '../cache'

const KEY = 'fov:settings'
const TTL_MS = 10 * 365 * 86_400_000
const KINDS: readonly TelescopeKind[] = ['refractor', 'newtonian', 'sct', 'maksutov', 'custom']
const ORIENTATIONS: readonly ImageOrientation[] = ['sky', 'inverted', 'mirrored']

const defaultScope = TELESCOPE_PRESETS.find((p) => p.id === 'newton-200-1000')!

export const DEFAULT_FOV_SETTINGS: FovSettings = {
  mode: 'visual',
  telescopeId: defaultScope.id,
  telescope: { kind: defaultScope.kind, apertureMm: defaultScope.apertureMm, focalLengthMm: defaultScope.focalLengthMm },
  eyepiece: { focalLengthMm: 25, apparentFieldDeg: 52 },
  barlow: 1,
  sensorId: 'aps-c',
  sensor: { widthMm: 23.5, heightMm: 15.6 },
  sensorRotationDeg: 0,
  orientation: 'sky',
}

/** Borne `v` dans [min, max] ; `fallback` si non numérique. */
export function clampNumber(v: unknown, [min, max]: readonly [number, number], fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

/** Angle ramené dans [0, 180) (un rectangle est symétrique par demi-tour). */
export const normalizeRotation = (deg: number) => ((deg % 180) + 180) % 180

export function sanitizeFovSettings(raw: unknown): FovSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_FOV_SETTINGS
  const r = raw as Partial<Record<keyof FovSettings, unknown>>
  const d = DEFAULT_FOV_SETTINGS
  const t = (r.telescope ?? {}) as Record<string, unknown>
  const e = (r.eyepiece ?? {}) as Record<string, unknown>
  const s = (r.sensor ?? {}) as Record<string, unknown>
  const telescopeId = typeof r.telescopeId === 'string' && (r.telescopeId === 'custom' || TELESCOPE_PRESETS.some((p) => p.id === r.telescopeId)) ? r.telescopeId : d.telescopeId
  const sensorId = typeof r.sensorId === 'string' && (r.sensorId === 'custom' || SENSOR_PRESETS.some((p) => p.id === r.sensorId)) ? r.sensorId : d.sensorId
  return {
    mode: r.mode === 'photo' ? 'photo' : 'visual',
    telescopeId,
    telescope: {
      kind: KINDS.includes(t.kind as TelescopeKind) ? (t.kind as TelescopeKind) : d.telescope.kind,
      apertureMm: clampNumber(t.apertureMm, OPTICS_LIMITS.apertureMm, d.telescope.apertureMm),
      focalLengthMm: clampNumber(t.focalLengthMm, OPTICS_LIMITS.focalLengthMm, d.telescope.focalLengthMm),
    },
    eyepiece: {
      focalLengthMm: clampNumber(e.focalLengthMm, OPTICS_LIMITS.eyepieceMm, d.eyepiece.focalLengthMm),
      apparentFieldDeg: clampNumber(e.apparentFieldDeg, OPTICS_LIMITS.apparentFieldDeg, d.eyepiece.apparentFieldDeg),
    },
    barlow: ([1, 2, 3] as const).includes(r.barlow as BarlowFactor) ? (r.barlow as BarlowFactor) : 1,
    sensorId,
    sensor: {
      widthMm: clampNumber(s.widthMm, OPTICS_LIMITS.sensorMm, d.sensor.widthMm),
      heightMm: clampNumber(s.heightMm, OPTICS_LIMITS.sensorMm, d.sensor.heightMm),
    },
    sensorRotationDeg: normalizeRotation(clampNumber(r.sensorRotationDeg, [-3600, 3600], 0)),
    orientation: ORIENTATIONS.includes(r.orientation as ImageOrientation) ? (r.orientation as ImageOrientation) : 'sky',
  }
}

/** Applique un préréglage de télescope (`"custom"` conserve les valeurs saisies). */
export function withTelescopePreset(s: FovSettings, id: string): FovSettings {
  const p = TELESCOPE_PRESETS.find((x) => x.id === id)
  if (!p) return { ...s, telescopeId: 'custom', telescope: { ...s.telescope, kind: 'custom' } }
  return { ...s, telescopeId: p.id, telescope: { kind: p.kind, apertureMm: p.apertureMm, focalLengthMm: p.focalLengthMm } }
}

export function withSensorPreset(s: FovSettings, id: string): FovSettings {
  const p = SENSOR_PRESETS.find((x) => x.id === id)
  if (!p) return { ...s, sensorId: 'custom' }
  return { ...s, sensorId: p.id, sensor: { widthMm: p.widthMm, heightMm: p.heightMm } }
}

/** Champ apparent suivant / précédent de la liste des préréglages. */
export function stepApparentField(current: number, dir: 1 | -1): number {
  const list = APPARENT_FIELD_PRESETS_DEG
  if (dir > 0) return list.find((v) => v > current) ?? list[list.length - 1]
  return [...list].reverse().find((v) => v < current) ?? list[0]
}

export async function loadFovSettings(): Promise<FovSettings> {
  return sanitizeFovSettings(await cacheGet<FovSettings>(KEY))
}

export async function saveFovSettings(settings: FovSettings): Promise<void> {
  await cacheSet(KEY, settings, TTL_MS)
}
