/**
 * Sections des palettes Canvas propres aux instruments : simulateur de champ
 * (catalogue) et radar orbital. En vision nocturne, rouges purs uniquement.
 */

/** Couleurs du simulateur de champ : champ, réticule, silhouettes, étoiles, Lune. */
export interface FovPalette {
  readonly field: string
  readonly vignette: string
  readonly fieldStop: string
  readonly reticle: string
  readonly tick: string
  readonly label: string
  readonly objectCore: string
  readonly objectHalo: string
  readonly objectEdge: string
  readonly neighbor: string
  readonly darkNebula: string
  readonly star: string
  readonly moon: string
  readonly moonEdge: string
  readonly frame: string
  readonly compass: string
  readonly threshold: string
}

/** Couleurs du radar orbital : trajectoires éclairée / dans l'ombre / de jour, satellites, évènements. */
export interface OrbitalPalette {
  readonly scope: string
  readonly sweep: string
  readonly trackVisible: string
  readonly trackShadow: string
  readonly trackDay: string
  readonly satLit: string
  readonly satShadow: string
  readonly selected: string
  readonly event: string
  readonly shadowEvent: string
  readonly label: string
}

export const DARK_FOV: FovPalette = {
  field: '#03060D',
  vignette: 'rgba(0, 0, 0, 0.74)',
  fieldStop: 'rgba(148, 163, 184, 0.85)',
  reticle: 'rgba(56, 189, 248, 0.55)',
  tick: 'rgba(148, 163, 184, 0.6)',
  label: '#CBD5E1',
  objectCore: 'rgba(241, 245, 249, 0.95)',
  objectHalo: 'rgba(186, 200, 225, 0.4)',
  objectEdge: 'rgba(244, 114, 182, 0.7)',
  neighbor: 'rgba(203, 213, 225, 0.75)',
  darkNebula: 'rgba(0, 0, 0, 0.85)',
  star: '#F8FAFC',
  moon: 'rgba(226, 232, 240, 0.16)',
  moonEdge: 'rgba(226, 232, 240, 0.7)',
  frame: '#38BDF8',
  compass: '#FBBF24',
  threshold: 'rgba(52, 211, 153, 0.7)',
}

export const RED_NIGHT_FOV: FovPalette = {
  field: '#080000',
  vignette: 'rgba(0, 0, 0, 0.74)',
  fieldStop: 'rgba(255, 0, 0, 0.75)',
  reticle: 'rgba(255, 0, 0, 0.5)',
  tick: 'rgba(255, 0, 0, 0.55)',
  label: '#D00000',
  objectCore: 'rgba(255, 0, 0, 0.95)',
  objectHalo: 'rgba(200, 0, 0, 0.4)',
  objectEdge: 'rgba(255, 0, 0, 0.6)',
  neighbor: 'rgba(220, 0, 0, 0.7)',
  darkNebula: 'rgba(0, 0, 0, 0.85)',
  star: '#FF2A2A',
  moon: 'rgba(255, 0, 0, 0.14)',
  moonEdge: 'rgba(255, 0, 0, 0.6)',
  frame: '#FF2A2A',
  compass: '#D40000',
  threshold: 'rgba(255, 0, 0, 0.6)',
}

export const DARK_ORBITAL: OrbitalPalette = {
  scope: '#03070F',
  sweep: 'rgba(56, 189, 248, 0.10)',
  trackVisible: '#38BDF8',
  trackShadow: 'rgba(148, 163, 184, 0.55)',
  trackDay: 'rgba(148, 163, 184, 0.3)',
  satLit: '#F8FAFC',
  satShadow: 'rgba(148, 163, 184, 0.5)',
  selected: '#FBBF24',
  event: '#E2E8F0',
  shadowEvent: '#A78BFA',
  label: '#CBD5E1',
}

export const RED_NIGHT_ORBITAL: OrbitalPalette = {
  scope: '#080000',
  sweep: 'rgba(255, 0, 0, 0.1)',
  trackVisible: '#FF2A2A',
  trackShadow: 'rgba(180, 0, 0, 0.55)',
  trackDay: 'rgba(140, 0, 0, 0.35)',
  satLit: '#FF2A2A',
  satShadow: 'rgba(160, 0, 0, 0.55)',
  selected: '#E00000',
  event: '#D00000',
  shadowEvent: '#9A0000',
  label: '#C00000',
}
