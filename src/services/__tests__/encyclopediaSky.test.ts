import { describe, expect, it } from 'vitest'
import { getAltitudeCurve, getNightTimeline } from '../astroEngine'
import { DARK_SKY_NELM, getInstrumentAdvice, telescopeMagnification } from '../catalog/advice'
import { findDeepSkyEntry } from '../catalog/entries'
import { ELEVATION_STEP_MIN, elevationWindow, getNightElevationProfile, roundHours } from '../catalog/nightElevation'
import { bestMonthsOf, circumpolarity, getSeasonInfo, meridianAltitudeDeg } from '../catalog/season'
import type { SkyTarget } from '../../types/astro'

const PARIS = { latitudeDeg: 48.8566, longitudeDeg: 2.3522, elevationM: 35 }
const SYDNEY = { latitudeDeg: -33.8688, longitudeDeg: 151.2093, elevationM: 20 }
const NOW = new Date('2026-11-18T21:00:00Z')
const fixed = (id: string): SkyTarget => {
  const o = findDeepSkyEntry(id)!.object
  return { kind: 'fixed', raDeg: o.raDeg, decDeg: o.decDeg, label: id }
}

describe('profil d’élévation nocturne', () => {
  const tl = getNightTimeline(NOW, PARIS)
  const m31 = getNightElevationProfile(fixed('M31'), NOW, PARIS, tl)

  it('couvre du coucher −1 h au lever +1 h avec un pas régulier', () => {
    const { start, end } = elevationWindow(tl)
    expect(m31.start).toEqual(start)
    expect(m31.end).toEqual(end)
    expect(start.getTime()).toBeCloseTo(tl.transitions[0].time.getTime() - 3_600_000, -3)
    expect(m31.samples[1].time.getTime() - m31.samples[0].time.getTime()).toBe(ELEVATION_STEP_MIN * 60_000)
    expect(m31.samples.at(-1)!.time.getTime()).toBeLessThanOrEqual(end.getTime())
  })

  it('relevés heure par heure sur des heures rondes, nuit noire signalée', () => {
    expect(m31.hourly.length).toBeGreaterThanOrEqual(15)
    for (const h of m31.hourly) expect(h.time.getUTCMinutes()).toBe(0)
    const midnight = m31.hourly.find((h) => h.time.toISOString() === '2026-11-18T23:00:00.000Z')!
    expect(midnight.dark).toBe(true)
    expect(m31.hourly[0].dark).toBe(false)
  })

  it('culmination affinée à la minute, cohérente avec le passage au méridien', () => {
    const rts = m31.riseTransitSet
    expect(rts.transit).not.toBeNull()
    // M31 culmine vers 19 h 40 UTC mi-novembre à ~82° à Paris.
    expect(Math.abs(m31.culmination.time.getTime() - rts.transit!.getTime())).toBeLessThan(2 * 60_000)
    expect(m31.culmination.altitudeDeg).toBeCloseTo(rts.transitAltitudeDeg!, 0)
    expect(m31.culmination.altitudeDeg).toBeGreaterThan(80)
    expect(m31.culmination.duringDarkness).toBe(true)
    expect(rts.alwaysUp).toBe(true) // circumpolaire à Paris (δ = +41°)
    expect(m31.observableDarkMinutes).toBeGreaterThan(8 * 60)
  })

  it('M42 : lever, passage et coucher dans l’ordre, culmination au petit matin', () => {
    const p = getNightElevationProfile(fixed('M42'), NOW, PARIS, tl)
    const { rise, transit, set } = p.riseTransitSet
    expect(rise && transit && set).toBeTruthy()
    expect(rise!.getTime()).toBeLessThan(transit!.getTime())
    expect(transit!.getTime()).toBeLessThan(set!.getTime())
    expect(p.culmination.altitudeDeg).toBeCloseTo(90 - 48.8566 - 5.39, 0)
  })

  it('astre mobile : la Lune passe par le même calcul', () => {
    const p = getNightElevationProfile({ kind: 'body', id: 'Moon' }, NOW, PARIS, tl)
    const ref = getAltitudeCurve({ kind: 'body', id: 'Moon' }, p.start, p.end.getTime() - p.start.getTime(), ELEVATION_STEP_MIN * 60_000, PARIS)
    expect(p.samples.map((s) => s.altitudeDeg)).toEqual(ref.map((s) => s.altitudeDeg))
  })

  it('heures rondes', () => {
    expect(roundHours(new Date('2026-01-01T10:20:00Z'), new Date('2026-01-01T13:00:00Z')).length).toBe(3)
  })
})

describe('saison idéale', () => {
  it('M42 : meilleure de décembre à février depuis Paris, culmine à minuit vers mi-décembre', () => {
    const s = getSeasonInfo(83.82, -5.39, 2026, PARIS)
    expect(s.months).toHaveLength(12)
    expect(s.bestMonths).toEqual(expect.arrayContaining([11, 0]))
    expect(s.bestMonths).not.toContain(6)
    expect(s.months[6].darkMinutesAbove30).toBe(0)
    const d = s.midnightCulmination!
    expect(d.getUTCMonth()).toBe(11)
    expect(d.getUTCDate()).toBeGreaterThanOrEqual(5)
    expect(d.getUTCDate()).toBeLessThanOrEqual(20)
    expect(s.meridianAltitudeDeg).toBeCloseTo(35.75, 1)
  })

  it('ordre de saison contigu par-dessus le changement d’année', () => {
    const months = Array.from({ length: 12 }, (_, m) => ({ month: m, darkMinutesAbove30: [10, 1, 11].includes(m) ? 100 : 0, maxDarkAltitudeDeg: 50 }))
    expect(bestMonthsOf(months)).toEqual([10, 11, 1])
    expect(bestMonthsOf(months.map((m) => ({ ...m, darkMinutesAbove30: 0 })))).toEqual([])
  })

  it('circumpolarité et objets jamais levés selon l’hémisphère', () => {
    expect(circumpolarity(69.07, PARIS.latitudeDeg)).toEqual({ circumpolar: true, neverRises: false }) // M81
    expect(circumpolarity(-72.08, PARIS.latitudeDeg)).toEqual({ circumpolar: false, neverRises: true }) // 47 Tuc
    expect(circumpolarity(-72.08, SYDNEY.latitudeDeg)).toEqual({ circumpolar: true, neverRises: false })
    expect(getSeasonInfo(6.02, -72.08, 2026, PARIS).midnightCulmination).toBeNull()
    expect(meridianAltitudeDeg(41.27, 48.86)).toBeCloseTo(82.41, 1)
  })
})

describe('conseils par instrument', () => {
  it('M31 : visible à l’œil nu, déborde du champ du télescope', () => {
    const [eye, bino, scope] = getInstrumentAdvice(findDeepSkyEntry('M31')!)
    expect(eye.instrument).toBe('naked-eye')
    expect(['accessible', 'easy', 'showpiece']).toContain(eye.verdict)
    expect(['easy', 'showpiece']).toContain(bino.verdict)
    expect(scope.fieldFillRatio!).toBeGreaterThan(1)
    expect(scope.tips.some((t) => t.includes('champ'))).toBe(true)
    expect(eye.magnificationRange).toBeNull()
    expect(bino.magnificationRange).toEqual([7, 15])
  })

  it('nébuleuse planétaire compacte : invisible à l’œil nu, fort grossissement au télescope', () => {
    const [eye, , scope] = getInstrumentAdvice(findDeepSkyEntry('NGC2392')!)
    expect(eye.verdict).toBe('invisible')
    expect(eye.tips[0]).toMatch(/Magnitude/)
    expect(['accessible', 'easy', 'showpiece']).toContain(scope.verdict)
    expect(scope.magnificationRange![0]).toBeGreaterThanOrEqual(150)
    expect(scope.tips[0]).toMatch(/OIII/)
  })

  it('galaxie de faible brillance de surface : plus difficile que sa magnitude ne le laisse croire', () => {
    const m33 = getInstrumentAdvice(findDeepSkyEntry('M33')!)
    expect(['invisible', 'difficult', 'accessible']).toContain(m33[0].verdict)
    expect(m33[0].magnitudeMargin!).toBeLessThan(DARK_SKY_NELM - 0.8 - findDeepSkyEntry('M33')!.object.mag!)
  })

  it('nébuleuse obscure sans magnitude : détectable au télescope uniquement par contraste', () => {
    const [eye, , scope] = getInstrumentAdvice(findDeepSkyEntry('IC434')!)
    expect(eye.verdict).toBe('invisible')
    expect(scope.verdict).toBe('difficult')
    expect(scope.magnitudeMargin).toBeNull()
  })

  it('grossissement adapté à la taille et plafonné à 2 × D', () => {
    const [lo, hi] = telescopeMagnification('open-cluster', 80, 200)
    expect(hi).toBeLessThanOrEqual(35)
    expect(lo).toBeLessThan(hi)
    expect(telescopeMagnification('planetary-nebula', 0.5, 100)).toEqual([150, 200])
  })
})
