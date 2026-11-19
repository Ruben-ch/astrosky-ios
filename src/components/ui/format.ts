/** Formateurs d'affichage (heure locale de l'appareil, unités françaises). */

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const timeSecFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fullDateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const fmtTime = (d: Date | null | undefined) => (d ? timeFmt.format(d) : '—')
export const fmtTimeSec = (d: Date) => timeSecFmt.format(d)
export const fmtDay = (d: Date) => dayFmt.format(d).replace(/\./g, '')
export const fmtFullDate = (d: Date) => fullDateFmt.format(d)

/** Angle signé en degrés avec une décimale : `+42,3°`. */
export function fmtDeg(valueDeg: number, digits = 1, signed = false): string {
  const s = valueDeg.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${signed && valueDeg >= 0 ? '+' : ''}${s}°`
}

/** Nombre au format français, avec le vrai signe moins typographique. */
export function fmtNumber(value: number, digits = 0): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−')
}

export function fmtMag(mag: number | null): string {
  if (mag === null) return '—'
  return `${mag < 0 ? '−' : ''}${Math.abs(mag).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

/** Durée en minutes vers « 9 h 42 » / « 35 min ». */
export function fmtDuration(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** Délai relatif court : « dans 2 h 05 », « il y a 12 min ». */
export function fmtRelative(target: Date, now: Date): string {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000)
  if (Math.abs(diffMin) < 1) return 'maintenant'
  const abs = Math.abs(diffMin)
  const body = abs >= 1440 ? `${Math.round(abs / 1440)} j` : fmtDuration(abs)
  return diffMin > 0 ? `dans ${body}` : `il y a ${body}`
}

/** Valeur pour <input type="datetime-local"> en heure locale. */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
