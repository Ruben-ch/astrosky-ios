import { describe, expect, it } from 'vitest'
import {
  MAX_SIM_MS,
  MIN_SIM_MS,
  MS_PER_DAY,
  MS_PER_HOUR,
  createAnchor,
  formatOffset,
  formatRate,
  isLive,
  jumpTo,
  offsetFromReal,
  resetToNow,
  shiftBy,
  simTimeAt,
  withRate,
} from '../simulationClock'

const T0 = Date.UTC(2026, 10, 18, 20, 0)

describe('simulationClock', () => {
  it('suit le temps réel à 1×', () => {
    const a = createAnchor(T0)
    expect(simTimeAt(a, T0 + 5000)).toBe(T0 + 5000)
    expect(isLive(a, T0 + 5000)).toBe(true)
  })

  it('accélère sans discontinuité lors d’un changement de vitesse', () => {
    const a = createAnchor(T0)
    const b = withRate(a, 3600, T0 + 10_000)
    expect(simTimeAt(b, T0 + 10_000)).toBe(T0 + 10_000)
    expect(simTimeAt(b, T0 + 11_000)).toBe(T0 + 10_000 + MS_PER_HOUR)
    expect(isLive(b, T0 + 11_000)).toBe(false)
  })

  it('gèle le temps en pause et rembobine en vitesse négative', () => {
    const paused = withRate(createAnchor(T0), 0, T0)
    expect(simTimeAt(paused, T0 + 60_000)).toBe(T0)
    const rewind = withRate(createAnchor(T0), -60, T0)
    expect(simTimeAt(rewind, T0 + 1000)).toBe(T0 - 60_000)
  })

  it('décale et saute à une date en conservant la vitesse', () => {
    const a = withRate(createAnchor(T0), 60, T0)
    const shifted = shiftBy(a, MS_PER_DAY, T0)
    expect(simTimeAt(shifted, T0)).toBe(T0 + MS_PER_DAY)
    expect(shifted.rate).toBe(60)
    const jumped = jumpTo(a, Date.UTC(2027, 7, 12), T0)
    expect(simTimeAt(jumped, T0)).toBe(Date.UTC(2027, 7, 12))
    expect(offsetFromReal(shifted, T0)).toBe(MS_PER_DAY)
  })

  it('borne le voyage dans le temps', () => {
    expect(simTimeAt(jumpTo(createAnchor(T0), Date.UTC(1000, 0, 1), T0), T0)).toBe(MIN_SIM_MS)
    expect(simTimeAt(shiftBy(createAnchor(T0), 1e15, T0), T0)).toBe(MAX_SIM_MS)
  })

  it('revient au direct', () => {
    const r = resetToNow(T0 + 42)
    expect(isLive(r, T0 + 42)).toBe(true)
    expect(r.rate).toBe(1)
  })

  it('formate écarts et vitesses', () => {
    expect(formatOffset(-45 * 60_000)).toBe('−45 min')
    expect(formatOffset(2 * MS_PER_DAY + 3 * MS_PER_HOUR + 15 * 60_000)).toBe('+2 j 03 h 15 min')
    expect(formatOffset(90 * 60_000)).toBe('+1 h 30 min')
    expect(formatRate(1)).toBe('1×')
    expect(formatRate(0)).toBe('Pause')
    expect(formatRate(60)).toBe('1 min/s')
    expect(formatRate(-3600)).toBe('−1 h/s')
    expect(formatRate(86_400)).toBe('1 j/s')
  })
})
