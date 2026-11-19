/**
 * Prédiction des passages visibles sur 48 h (ISS, Tiangong, satellites
 * brillants) : balayage limité aux fenêtres de nuit (Soleil < −6°), levers et
 * couchers affinés à la seconde, trajectoire, ombre de la Terre et magnitude.
 * Version asynchrone découpée en tranches courtes pour garder l'interface à 60 fps.
 */
import type { ObserverLocation } from '../../types/astro'
import type { Interval } from '../../types/tonight'
import type { OrbitalCandidate, PassPredictionOptions, PassPredictionProgress, VisiblePass } from '../../types/orbital'
import { getSunGeometricAltitudeDeg } from '../astro/bodies'
import { ALWAYS_INCLUDED, PASS_MAGNITUDE_LIMIT, satelliteDisplayName } from './brightCatalog'
import { SUN_MAX_ALT_DEG, TRACK_STEP_MS, bisect, createSampler, sampleTrack, shadowTransitions, ternaryMax, toEvent, type Sampler } from './passTrack'

const MIN = 60_000
/** Pas du balayage grossier des hauteurs. */
const SCAN_STEP_MS = MIN
/** Pas d'échantillonnage du Soleil pour délimiter les nuits. */
const SUN_STEP_MS = 5 * MIN
/** Marge autour des fenêtres de nuit : un passage peut commencer au crépuscule. */
const WINDOW_MARGIN_MS = 20 * MIN
/** Recul maximal pour retrouver le lever d'un satellite déjà levé en début de fenêtre. */
const MAX_PASS_MS = 25 * MIN

export const DEFAULT_PASS_OPTIONS: PassPredictionOptions = {
  hours: 48,
  minCulminationDeg: 10,
  magnitudeLimit: PASS_MAGNITUDE_LIMIT,
  alwaysInclude: ALWAYS_INCLUDED,
}

/** Intervalles où le Soleil est sous −6° (observateur dans la nuit), sur [start, start + hours]. */
export function darkIntervals(start: Date, hours: number, loc: ObserverLocation): Interval[] {
  const out: Interval[] = []
  const t0 = start.getTime()
  const t1 = t0 + hours * 3_600_000
  const dark = (t: number) => getSunGeometricAltitudeDeg(new Date(t), loc) < SUN_MAX_ALT_DEG
  let prevT = t0
  let prev = dark(t0)
  let openAt: number | null = prev ? t0 : null
  for (let t = t0 + SUN_STEP_MS; t <= t1 + SUN_STEP_MS; t += SUN_STEP_MS) {
    const tt = Math.min(t, t1)
    const cur = dark(tt)
    if (cur !== prev) {
      const edge = bisect(dark, prevT, tt)
      if (cur) openAt = edge
      else if (openAt !== null) {
        out.push({ start: new Date(openAt), end: new Date(edge) })
        openAt = null
      }
    }
    prevT = tt
    prev = cur
    if (tt === t1) break
  }
  if (openAt !== null) out.push({ start: new Date(openAt), end: new Date(t1) })
  return out
}

/** Construit un passage visible à partir de son lever et de son coucher, ou `null` s'il ne convient pas. */
function buildPass(c: OrbitalCandidate, sampler: Sampler, riseMs: number, setMs: number, opts: PassPredictionOptions): VisiblePass | null {
  const culmMs = ternaryMax(sampler.elevation, riseMs, setMs)
  if (sampler.elevation(culmMs) < opts.minCulminationDeg) return null
  const track = sampleTrack(sampler, riseMs, setMs, c.stdMag)
  const visible = track.filter((p) => p.visible)
  if (visible.length === 0) return null
  const mags = visible.map((p) => p.magnitude).filter((m): m is number => m !== null)
  const peakMagnitude = mags.length ? Math.min(...mags) : null
  const always = opts.alwaysInclude.includes(c.record.noradId)
  if (!always && (peakMagnitude === null || peakMagnitude >= opts.magnitudeLimit)) return null
  const at = (t: number) => sampler.sample(t, { stdMag: c.stdMag, withSun: true })
  const rise = at(riseMs)
  const culm = at(culmMs)
  const set = at(setMs)
  if (!rise || !culm || !set) return null
  const { entry, exit } = shadowTransitions(sampler, track, c.stdMag)
  const first = visible[0]
  const last = visible[visible.length - 1]
  return {
    id: `${c.record.noradId}-${Math.round(riseMs)}`,
    noradId: c.record.noradId,
    name: satelliteDisplayName(c.record),
    stdMag: c.stdMag,
    rise: toEvent(rise),
    culmination: toEvent(culm),
    set: toEvent(set),
    shadowEntry: entry,
    shadowExit: exit,
    visibleStart: toEvent(first),
    visibleEnd: toEvent(last),
    peakMagnitude,
    durationSec: Math.round((setMs - riseMs) / 1000),
    visibleDurationSec: Math.round((last.time.getTime() - first.time.getTime() + TRACK_STEP_MS) / 1000),
    track,
  }
}

/** Passages visibles d'un satellite dans les fenêtres de nuit données. */
export function passesForCandidate(c: OrbitalCandidate, windows: readonly Interval[], loc: ObserverLocation, opts: PassPredictionOptions): VisiblePass[] {
  const sampler = createSampler(c.record, loc)
  const out: VisiblePass[] = []
  const above = (t: number) => sampler.elevation(t) >= 0
  let lastSetMs = -Infinity
  for (const w of windows) {
    const a = w.start.getTime() - WINDOW_MARGIN_MS
    const b = w.end.getTime() + WINDOW_MARGIN_MS
    let prevT = a
    let prevUp = above(a)
    let riseMs: number | null = null
    if (prevUp) {
      // Déjà levé : on recule jusqu'au lever (borne : durée maximale d'un passage).
      let t = a
      while (t > a - MAX_PASS_MS && above(t - SCAN_STEP_MS)) t -= SCAN_STEP_MS
      riseMs = bisect(above, t - SCAN_STEP_MS, t)
    }
    for (let t = a + SCAN_STEP_MS; t <= b + MAX_PASS_MS; t += SCAN_STEP_MS) {
      const up = above(t)
      if (!prevUp && up) {
        if (t > b) break
        riseMs = bisect(above, prevT, t)
      } else if (prevUp && !up && riseMs !== null) {
        const setMs = bisect(above, prevT, t)
        if (riseMs > lastSetMs) {
          const pass = buildPass(c, sampler, riseMs, setMs, opts)
          if (pass) out.push(pass)
          lastSetMs = setMs
        }
        riseMs = null
        if (t > b) break
      }
      prevT = t
      prevUp = up
    }
  }
  return out
}

/** Prédiction synchrone (tests, petits lots). */
export function predictVisiblePasses(
  candidates: readonly OrbitalCandidate[],
  start: Date,
  loc: ObserverLocation,
  opts: PassPredictionOptions = DEFAULT_PASS_OPTIONS,
): VisiblePass[] {
  const windows = darkIntervals(start, opts.hours, loc)
  return candidates.flatMap((c) => passesForCandidate(c, windows, loc, opts)).sort((x, y) => x.rise.time.getTime() - y.rise.time.getTime())
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Prédiction asynchrone : un satellite à la fois, en rendant la main à
 * l'interface dès qu'une tranche dépasse `sliceMs`. Annulable par `signal`.
 */
export async function predictVisiblePassesAsync(
  candidates: readonly OrbitalCandidate[],
  start: Date,
  loc: ObserverLocation,
  opts: PassPredictionOptions = DEFAULT_PASS_OPTIONS,
  hooks: { signal?: AbortSignal; onProgress?: (p: PassPredictionProgress, partial: readonly VisiblePass[]) => void; sliceMs?: number } = {},
): Promise<VisiblePass[]> {
  const sliceMs = hooks.sliceMs ?? 8
  const windows = darkIntervals(start, opts.hours, loc)
  const out: VisiblePass[] = []
  let sliceStart = performance.now()
  for (let i = 0; i < candidates.length; i++) {
    if (hooks.signal?.aborted) throw new DOMException('Prédiction annulée', 'AbortError')
    out.push(...passesForCandidate(candidates[i], windows, loc, opts))
    if (performance.now() - sliceStart > sliceMs) {
      out.sort((x, y) => x.rise.time.getTime() - y.rise.time.getTime())
      hooks.onProgress?.({ done: i + 1, total: candidates.length }, out.slice())
      await yieldToUi()
      sliceStart = performance.now()
    }
  }
  out.sort((x, y) => x.rise.time.getTime() - y.rise.time.getTime())
  hooks.onProgress?.({ done: candidates.length, total: candidates.length }, out.slice())
  return out
}

/** Prochain passage (en cours ou à venir) à l'instant `nowMs`. */
export function nextPass(passes: readonly VisiblePass[], nowMs: number): VisiblePass | null {
  return passes.find((p) => p.set.time.getTime() >= nowMs) ?? null
}

/** Position interpolée sur la trajectoire d'un passage à l'instant `nowMs`, `null` hors passage. */
export function positionOnTrack(pass: VisiblePass, nowMs: number): { azimuthDeg: number; elevationDeg: number } | null {
  const tr = pass.track
  if (tr.length < 2 || nowMs < tr[0].time.getTime() || nowMs > tr[tr.length - 1].time.getTime()) return null
  const i = Math.min(tr.length - 1, Math.max(1, tr.findIndex((p) => p.time.getTime() >= nowMs)))
  const a = tr[i - 1]
  const b = tr[i]
  const k = (nowMs - a.time.getTime()) / Math.max(1, b.time.getTime() - a.time.getTime())
  const dAz = ((b.azimuthDeg - a.azimuthDeg + 540) % 360) - 180
  return { azimuthDeg: (a.azimuthDeg + dAz * k + 360) % 360, elevationDeg: a.elevationDeg + (b.elevationDeg - a.elevationDeg) * k }
}
