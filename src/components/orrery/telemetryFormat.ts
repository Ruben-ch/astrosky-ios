/** Formateurs de la télémétrie du Système Solaire 3D (unités françaises, chiffres tabulaires). */
import { KM_PER_AU } from 'astronomy-engine'
import { fmtNumber } from '../ui/format'

/** Distance en UA, précision adaptée : « 0,3871 », « 5,203 », « 30,07 ». */
export function fmtAu(au: number | null): string {
  if (au === null) return '—'
  return fmtNumber(au, au < 1 ? 4 : au < 10 ? 3 : 2)
}

/** Distance en kilomètres : « 384 400 km », « 149,6 M km », « 4,47 Md km ». */
export function fmtKm(au: number | null): string {
  if (au === null) return '—'
  const km = au * KM_PER_AU
  if (km >= 1e9) return `${fmtNumber(km / 1e9, 2)} Md km`
  if (km >= 1e6) return `${fmtNumber(km / 1e6, 1)} M km`
  return `${fmtNumber(km, 0)} km`
}

/** Diamètre apparent : « 32′ 24″ » au-delà d'une minute d'arc, sinon « 44,6″ ». */
export function fmtArcsec(arcsec: number | null): string {
  if (arcsec === null) return '—'
  if (arcsec >= 60) {
    const total = Math.round(arcsec)
    return `${Math.floor(total / 60)}′ ${String(total % 60).padStart(2, '0')}″`
  }
  return `${fmtNumber(arcsec, arcsec < 10 ? 2 : 1)}″`
}

/** Période orbitale : jours sous 1000 j, années au-delà. */
export function fmtPeriod(days: number | null): string {
  if (days === null) return '—'
  if (days < 1000) return `${fmtNumber(days, days < 10 ? 3 : 2)} j`
  return `${fmtNumber(days / 365.25, days < 36_525 ? 2 : 1)} ans`
}

/** Temps-lumière : « 8 min 19 s », « 4 h 09 min ». */
export function fmtLightTime(minutes: number | null): string {
  if (minutes === null) return '—'
  const s = Math.round(minutes * 60)
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`
}

/** Fraction illuminée en pourcentage : « 99,2 % ». */
export function fmtPhase(fraction: number | null): string {
  if (fraction === null) return '—'
  return `${fmtNumber(fraction * 100, 1)} %`
}
