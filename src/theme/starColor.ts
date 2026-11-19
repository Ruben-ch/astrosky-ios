/**
 * Couleur perçue d'une étoile à partir de son indice B−V : B−V → température
 * effective (relation de Ballesteros 2012), puis température → sRGB par
 * l'approximation du corps noir de Tanner Helland. En vision nocturne, seule
 * la luminance est conservée dans le canal rouge.
 */
import type { ThemeName } from './palette'

/** Température effective (K) d'après Ballesteros (2012, EPL 97, 34008). */
export function bvToTemperatureK(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

function clamp255(x: number): number {
  return Math.round(Math.min(255, Math.max(0, x)))
}

/** Couleur sRGB [r, g, b] d'un corps noir à la température donnée (1000–40000 K). */
export function temperatureToRgb(tempK: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, tempK)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp255(r), clamp255(g), clamp255(b)]
}

export function starColor(bv: number | null, theme: ThemeName): string {
  const [r, g, b] = temperatureToRgb(bvToTemperatureK(bv ?? 0.65))
  if (theme === 'red-night') {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return `rgb(${clamp255(80 + luminance * 0.69)}, 0, 0)`
  }
  return `rgb(${r}, ${g}, ${b})`
}
