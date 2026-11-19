/**
 * Palettes des moteurs de rendu impératifs (Canvas 2D, Three.js) qui ne lisent
 * pas les variables CSS. En vision nocturne, chaque couleur est un rouge pur
 * (composantes verte et bleue nulles) entre #FF2A2A et #2A0000.
 */
import { DARK_FOV, DARK_ORBITAL, RED_NIGHT_FOV, RED_NIGHT_ORBITAL, type FovPalette, type OrbitalPalette } from './instrumentPalettes'

export type { FovPalette, OrbitalPalette }

export type ThemeName = 'dark' | 'red-night'

export interface RenderPalette {
  readonly background: string
  readonly surface: string
  readonly grid: string
  readonly gridStrong: string
  readonly text: string
  readonly textDim: string
  readonly accent: string
  readonly gold: string
  readonly horizonFill: string
  readonly twilight: readonly [day: string, civil: string, nautical: string, astronomical: string, night: string]
  readonly bodies: Readonly<Record<string, string>>
  readonly moonLit: string
  readonly moonDark: string
  readonly good: string
  readonly fair: string
  readonly poor: string
  /** Séries des graphiques horaires et de la frise de nuit. */
  readonly chart: {
    readonly cloudLow: string
    readonly cloudMid: string
    readonly cloudHigh: string
    readonly seeing: string
    readonly transparency: string
    readonly dew: string
    readonly moonUp: string
    readonly moonlessDark: string
    readonly selection: string
  }
  /** Planétarium (Canvas 2D). */
  readonly sky: {
    readonly milkyWay: string
    readonly constellationLine: string
    readonly constellationLabel: string
    readonly altAzGrid: string
    readonly equatorialGrid: string
    readonly equator: string
    readonly ecliptic: string
    readonly horizon: string
    readonly ground: string
    readonly cardinal: string
    readonly starLabel: string
    readonly deepSky: string
    readonly deepSkyLabel: string
    readonly reticle: string
    readonly guidance: string
    readonly halo: string
  }
  /** Système Solaire 3D (Three.js) : lumières, matériaux, orbites, couronne solaire. */
  readonly orrery: OrreryPalette
  /** Simulateur d'oculaire / cadrage et comparaison d'échelle (Canvas 2D). */
  readonly fov: FovPalette
  /** Radar orbital polaire (Canvas 2D). */
  readonly orbital: OrbitalPalette
}


/** Couleurs du Système Solaire 3D. `surfaces` : [teinte principale, teinte secondaire] par astre. */
export interface OrreryPalette {
  readonly sunCore: string
  readonly sunLimb: string
  readonly corona: string
  readonly coronaOuter: string
  readonly light: string
  readonly ambient: string
  readonly orbit: string
  readonly orbitSelected: string
  readonly moonOrbit: string
  readonly eclipticGrid: string
  readonly axis: string
  readonly ring: string
  readonly polarCap: string
  readonly surfaces: Readonly<Record<string, readonly [string, string]>>
}

export const DARK_PALETTE: RenderPalette = {
  background: '#000000',
  surface: '#090D16',
  grid: 'rgba(148, 163, 184, 0.14)',
  gridStrong: 'rgba(148, 163, 184, 0.38)',
  text: '#F8FAFC',
  textDim: '#94A3B8',
  accent: '#38BDF8',
  gold: '#FBBF24',
  horizonFill: 'rgba(56, 189, 248, 0.06)',
  twilight: ['#1E3A5F', '#17304F', '#0F1F38', '#0A1426', '#000000'],
  bodies: {
    Sun: '#FBBF24', Moon: '#E2E8F0', Mercury: '#A8A29E', Venus: '#FDE68A', Mars: '#F87171',
    Jupiter: '#FDBA74', Saturn: '#FCD34D', Uranus: '#67E8F9', Neptune: '#818CF8', target: '#38BDF8',
  },
  moonLit: '#E2E8F0',
  moonDark: '#0B1020',
  good: '#34D399',
  fair: '#FBBF24',
  poor: '#F87171',
  chart: {
    cloudLow: '#CBD5E1',
    cloudMid: '#94A3B8',
    cloudHigh: '#64748B',
    seeing: '#A78BFA',
    transparency: '#38BDF8',
    dew: '#2DD4BF',
    moonUp: 'rgba(226, 232, 240, 0.55)',
    moonlessDark: '#34D399',
    selection: 'rgba(56, 189, 248, 0.16)',
  },
  sky: {
    milkyWay: '#AFC4E8',
    constellationLine: 'rgba(125, 160, 210, 0.42)',
    constellationLabel: 'rgba(148, 175, 215, 0.75)',
    altAzGrid: 'rgba(52, 211, 153, 0.26)',
    equatorialGrid: 'rgba(96, 165, 250, 0.24)',
    equator: 'rgba(96, 165, 250, 0.5)',
    ecliptic: 'rgba(251, 191, 36, 0.6)',
    horizon: 'rgba(148, 163, 184, 0.75)',
    ground: 'rgba(6, 12, 10, 0.88)',
    cardinal: '#FBBF24',
    starLabel: 'rgba(226, 232, 240, 0.8)',
    deepSky: 'rgba(244, 114, 182, 0.75)',
    deepSkyLabel: 'rgba(244, 114, 182, 0.9)',
    reticle: 'rgba(248, 250, 252, 0.7)',
    guidance: '#38BDF8',
    halo: 'rgba(255, 255, 255, 0.16)',
  },
  orrery: {
    sunCore: '#FFF4D6',
    sunLimb: '#F59E0B',
    corona: 'rgba(253, 186, 116, 0.55)',
    coronaOuter: 'rgba(251, 146, 60, 0.12)',
    light: '#FFF6E5',
    ambient: '#1C2333',
    orbit: 'rgba(148, 163, 184, 0.34)',
    orbitSelected: '#38BDF8',
    moonOrbit: 'rgba(148, 163, 184, 0.26)',
    eclipticGrid: 'rgba(148, 163, 184, 0.12)',
    axis: 'rgba(56, 189, 248, 0.8)',
    ring: '#D8C49A',
    polarCap: '#F1F5F9',
    surfaces: {
      Mercury: ['#9C9690', '#6E6A66'], Venus: ['#E8D3A2', '#C9AE78'], Earth: ['#2F6FB5', '#3E8E5A'],
      Mars: ['#C1532E', '#8E3A22'], Jupiter: ['#D9B48A', '#A9764E'], Saturn: ['#E3CB91', '#B89A62'],
      Uranus: ['#9FD8E0', '#7FC0CC'], Neptune: ['#4D6FD6', '#3753B0'], Io: ['#E6D36A', '#C08A3A'],
      Europa: ['#D8CDBB', '#A68D72'], Ganymede: ['#9E9384', '#6F665A'], Callisto: ['#6E6458', '#4A4239'],
    },
  },
  fov: DARK_FOV,
  orbital: DARK_ORBITAL,
}

export const RED_NIGHT_PALETTE: RenderPalette = {
  background: '#000000',
  surface: '#120000',
  grid: 'rgba(255, 0, 0, 0.16)',
  gridStrong: 'rgba(255, 0, 0, 0.4)',
  text: '#FF2A2A',
  textDim: '#B30000',
  accent: '#FF2A2A',
  gold: '#D40000',
  horizonFill: 'rgba(255, 0, 0, 0.07)',
  twilight: ['#4A0000', '#3A0000', '#2A0000', '#1A0000', '#000000'],
  bodies: {
    Sun: '#FF2A2A', Moon: '#FF2A2A', Mercury: '#8A0000', Venus: '#FF2A2A', Mars: '#C00000',
    Jupiter: '#E00000', Saturn: '#B00000', Uranus: '#7A0000', Neptune: '#6A0000', target: '#FF2A2A',
  },
  moonLit: '#FF2A2A',
  moonDark: '#2A0000',
  good: '#FF2A2A',
  fair: '#B00000',
  poor: '#6A0000',
  chart: {
    cloudLow: '#E00000',
    cloudMid: '#A00000',
    cloudHigh: '#600000',
    seeing: '#FF2A2A',
    transparency: '#C00000',
    dew: '#D00000',
    moonUp: 'rgba(255, 0, 0, 0.5)',
    moonlessDark: '#FF2A2A',
    selection: 'rgba(255, 0, 0, 0.18)',
  },
  sky: {
    milkyWay: '#A00000',
    constellationLine: 'rgba(255, 0, 0, 0.36)',
    constellationLabel: 'rgba(255, 0, 0, 0.62)',
    altAzGrid: 'rgba(255, 0, 0, 0.22)',
    equatorialGrid: 'rgba(255, 0, 0, 0.2)',
    equator: 'rgba(255, 0, 0, 0.42)',
    ecliptic: 'rgba(255, 0, 0, 0.55)',
    horizon: 'rgba(255, 0, 0, 0.7)',
    ground: 'rgba(14, 0, 0, 0.9)',
    cardinal: '#FF2A2A',
    starLabel: 'rgba(255, 0, 0, 0.7)',
    deepSky: 'rgba(255, 0, 0, 0.6)',
    deepSkyLabel: 'rgba(255, 0, 0, 0.75)',
    reticle: 'rgba(255, 0, 0, 0.65)',
    guidance: '#FF2A2A',
    halo: 'rgba(255, 0, 0, 0.16)',
  },
  orrery: {
    sunCore: '#FF0000',
    sunLimb: '#900000',
    corona: 'rgba(255, 0, 0, 0.5)',
    coronaOuter: 'rgba(200, 0, 0, 0.12)',
    light: '#FF0000',
    ambient: '#3A0000',
    orbit: 'rgba(255, 0, 0, 0.32)',
    orbitSelected: '#FF2A2A',
    moonOrbit: 'rgba(255, 0, 0, 0.24)',
    eclipticGrid: 'rgba(255, 0, 0, 0.12)',
    axis: 'rgba(255, 0, 0, 0.8)',
    ring: '#C00000',
    polarCap: '#FF0000',
    surfaces: {
      Mercury: ['#900000', '#600000'], Venus: ['#E00000', '#B00000'], Earth: ['#A00000', '#C80000'],
      Mars: ['#C00000', '#800000'], Jupiter: ['#D00000', '#900000'], Saturn: ['#C80000', '#940000'],
      Uranus: ['#A80000', '#900000'], Neptune: ['#880000', '#680000'], Io: ['#D80000', '#A00000'],
      Europa: ['#C00000', '#900000'], Ganymede: ['#900000', '#680000'], Callisto: ['#700000', '#500000'],
    },
  },
  fov: RED_NIGHT_FOV,
  orbital: RED_NIGHT_ORBITAL,
}

export function paletteFor(theme: ThemeName): RenderPalette {
  return theme === 'red-night' ? RED_NIGHT_PALETTE : DARK_PALETTE
}

/** Couleur d'une note 0–100 dans la palette active. */
export function scoreColor(score: number, p: RenderPalette): string {
  if (score >= 65) return p.good
  if (score >= 35) return p.fair
  return p.poor
}
