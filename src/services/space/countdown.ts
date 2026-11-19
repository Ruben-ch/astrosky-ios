/** Compte à rebours T−/T+ vers un instant, piloté par l'horloge de simulation. */
import type { Countdown } from '../../types/space'

export function countdownTo(targetMs: number, nowMs: number): Countdown {
  const diff = targetMs - nowMs
  const sign: -1 | 1 = diff > 0 ? -1 : 1
  let s = Math.floor(Math.abs(diff) / 1000)
  const days = Math.floor(s / 86_400)
  s -= days * 86_400
  const hours = Math.floor(s / 3600)
  s -= hours * 3600
  const minutes = Math.floor(s / 60)
  return { sign, days, hours, minutes, seconds: s - minutes * 60, totalMs: diff }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** « T− 2 j 04:12:09 », « T− 00:42:10 », « T+ 00:03:15 ». */
export function formatCountdown(c: Countdown): string {
  const clock = `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`
  return `T${c.sign < 0 ? '−' : '+'} ${c.days > 0 ? `${c.days} j ` : ''}${clock}`
}

/** Version courte pour les listes : « dans 2 j 4 h », « dans 42 min 10 s », « il y a 3 min ». */
export function formatCountdownShort(c: Countdown): string {
  const body =
    c.days > 0 ? `${c.days} j ${c.hours} h`
    : c.hours > 0 ? `${c.hours} h ${pad(c.minutes)}`
    : c.minutes > 0 ? `${c.minutes} min ${pad(c.seconds)} s`
    : `${c.seconds} s`
  return c.sign < 0 ? `dans ${body}` : `il y a ${body}`
}
