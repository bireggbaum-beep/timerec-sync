import { describe, it, expect } from 'vitest'
import { pairStamps, explicitBreakMinutes, applyAutoBreaks, calculateDay } from './workday.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const stamp = (time, action) => ({ time, action, taskId: 1, taskName: 'Test', comment: '' })

const AUTO_BREAKS = {
  enabled: true,
  validateActual: false,
  evalOrder: 'highestThreshold',
  rules: [
    { afterWorkTime: '05:00', breakDuration: '00:30', enabled: true },
    { afterWorkTime: '08:00', breakDuration: '00:45', enabled: true },
    { afterWorkTime: '10:00', breakDuration: '01:00', enabled: true },
  ],
}

// ── pairStamps ────────────────────────────────────────────────────────────────

describe('pairStamps', () => {
  it('pairs a single in/out', () => {
    const events = pairStamps([stamp('08:00', 'in'), stamp('17:00', 'out')])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kommt: '08:00', geht: '17:00', durationMinutes: 540 })
  })

  it('pairs multiple in/out pairs', () => {
    const events = pairStamps([
      stamp('08:00', 'in'), stamp('12:00', 'out'),
      stamp('13:00', 'in'), stamp('17:00', 'out'),
    ])
    expect(events).toHaveLength(2)
    expect(events[0].durationMinutes).toBe(240)
    expect(events[1].durationMinutes).toBe(240)
  })

  it('handles open session (in without out)', () => {
    const events = pairStamps([stamp('08:00', 'in')])
    expect(events).toHaveLength(1)
    expect(events[0].geht).toBeNull()
    expect(events[0].durationMinutes).toBeNull()
  })

  it('skips orphan out-stamp', () => {
    const events = pairStamps([stamp('08:00', 'out')])
    expect(events).toHaveLength(0)
  })

  it('handles two consecutive ins (second becomes open)', () => {
    const events = pairStamps([
      stamp('08:00', 'in'),
      stamp('09:00', 'in'),
      stamp('17:00', 'out'),
    ])
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ kommt: '08:00', geht: null })
    expect(events[1]).toMatchObject({ kommt: '09:00', geht: '17:00', durationMinutes: 480 })
  })

  it('returns empty array for empty stamps', () => {
    expect(pairStamps([])).toHaveLength(0)
  })

  it('sorts stamps by time before pairing', () => {
    const events = pairStamps([
      stamp('17:00', 'out'),
      stamp('08:00', 'in'),
    ])
    expect(events[0]).toMatchObject({ kommt: '08:00', geht: '17:00' })
  })

  it('clamps negative duration to 0', () => {
    // out before in (bad data)
    const events = pairStamps([stamp('08:00', 'in'), stamp('07:00', 'out')])
    // after sorting: 07:00 out (orphan), 08:00 in (open)
    expect(events[0].geht).toBeNull()
  })
})

// ── explicitBreakMinutes ──────────────────────────────────────────────────────

describe('explicitBreakMinutes', () => {
  it('calculates break between two sessions', () => {
    const events = pairStamps([
      stamp('08:00', 'in'), stamp('12:00', 'out'),
      stamp('12:30', 'in'), stamp('17:00', 'out'),
    ])
    expect(explicitBreakMinutes(events)).toBe(30)
  })

  it('returns 0 for single session', () => {
    const events = pairStamps([stamp('08:00', 'in'), stamp('17:00', 'out')])
    expect(explicitBreakMinutes(events)).toBe(0)
  })

  it('returns 0 for open session', () => {
    const events = pairStamps([stamp('08:00', 'in')])
    expect(explicitBreakMinutes(events)).toBe(0)
  })
})

// ── applyAutoBreaks ───────────────────────────────────────────────────────────

describe('applyAutoBreaks', () => {
  it('returns 0 deduction below lowest threshold', () => {
    const result = applyAutoBreaks(240, 0, AUTO_BREAKS) // 4h < 5h
    expect(result.deductionMinutes).toBe(0)
    expect(result.ruleApplied).toBeNull()
  })

  it('applies lowest rule when just above threshold', () => {
    const result = applyAutoBreaks(301, 0, AUTO_BREAKS) // 5h01m
    expect(result.deductionMinutes).toBe(30)
    expect(result.ruleApplied?.afterWorkTime).toBe('05:00')
  })

  it('applies highest matching rule (highestThreshold)', () => {
    const result = applyAutoBreaks(481, 0, AUTO_BREAKS) // 8h01m → 45min
    expect(result.deductionMinutes).toBe(45)
    expect(result.ruleApplied?.afterWorkTime).toBe('08:00')
  })

  it('applies highest of all three rules at 10h+', () => {
    const result = applyAutoBreaks(601, 0, AUTO_BREAKS) // 10h01m → 60min
    expect(result.deductionMinutes).toBe(60)
  })

  it('firstMatch applies first matching rule only', () => {
    const breaks = { ...AUTO_BREAKS, evalOrder: 'firstMatch' }
    const result = applyAutoBreaks(601, 0, breaks) // 10h+ but firstMatch → 5h rule
    expect(result.deductionMinutes).toBe(30)
  })

  it('validateActual: skips deduction if explicit break covers rule', () => {
    const breaks = { ...AUTO_BREAKS, validateActual: true }
    const result = applyAutoBreaks(481, 45, breaks) // 8h work, 45min break taken → rule=45min, deduction=0
    expect(result.deductionMinutes).toBe(0)
  })

  it('validateActual: deducts shortfall only', () => {
    const breaks = { ...AUTO_BREAKS, validateActual: true }
    const result = applyAutoBreaks(481, 20, breaks) // 8h work, 20min break → 45min rule, deduct 25min
    expect(result.deductionMinutes).toBe(25)
  })

  it('returns 0 when autoBreaks disabled', () => {
    const result = applyAutoBreaks(600, 0, { ...AUTO_BREAKS, enabled: false })
    expect(result.deductionMinutes).toBe(0)
  })

  it('returns 0 when no rules enabled', () => {
    const breaks = {
      ...AUTO_BREAKS,
      rules: AUTO_BREAKS.rules.map(r => ({ ...r, enabled: false })),
    }
    expect(applyAutoBreaks(600, 0, breaks).deductionMinutes).toBe(0)
  })

  it('returns 0 for null/undefined config', () => {
    expect(applyAutoBreaks(600, 0, null).deductionMinutes).toBe(0)
    expect(applyAutoBreaks(600, 0, undefined).deductionMinutes).toBe(0)
  })
})

// ── calculateDay ──────────────────────────────────────────────────────────────

describe('calculateDay', () => {
  const TARGET = 495 // 8h15m

  it('empty stamps → zero total, negative delta', () => {
    const r = calculateDay([], TARGET, AUTO_BREAKS)
    expect(r.totalMinutes).toBe(0)
    expect(r.deltaMinutes).toBe(-TARGET)
    expect(r.events).toHaveLength(0)
  })

  it('null stamps same as empty', () => {
    const r = calculateDay(null, TARGET, AUTO_BREAKS)
    expect(r.totalMinutes).toBe(0)
  })

  it('normal day: 9h work, auto-break 45min → 8h15m = target', () => {
    const stamps = [stamp('08:00', 'in'), stamp('17:00', 'out')] // 9h = 540min
    const r = calculateDay(stamps, TARGET, AUTO_BREAKS)
    expect(r.rawMinutes).toBe(540)
    expect(r.autoBreakDeduction).toBe(45)
    expect(r.totalMinutes).toBe(495)
    expect(r.deltaMinutes).toBe(0)
  })

  it('day with explicit lunch break: break counts, auto-break deducts shortfall', () => {
    // 08:00–12:00 (240min) + 12:30–17:00 (270min) = 510min raw, 30min explicit break
    const stamps = [
      stamp('08:00', 'in'), stamp('12:00', 'out'),
      stamp('12:30', 'in'), stamp('17:00', 'out'),
    ]
    const breaks = { ...AUTO_BREAKS, validateActual: true }
    const r = calculateDay(stamps, TARGET, breaks)
    expect(r.rawMinutes).toBe(510)
    // 8h30m raw → rule: 45min. Explicit: 30min. Deduction: 15min.
    expect(r.autoBreakDeduction).toBe(15)
    expect(r.totalMinutes).toBe(495)
    expect(r.deltaMinutes).toBe(0)
  })

  it('open session does not count towards total', () => {
    const stamps = [stamp('08:00', 'in')] // no out
    const r = calculateDay(stamps, TARGET, AUTO_BREAKS)
    expect(r.openSession).toBe(true)
    expect(r.totalMinutes).toBe(0)
  })

  it('weekend (target 0): delta is null', () => {
    const stamps = [stamp('09:00', 'in'), stamp('12:00', 'out')]
    const r = calculateDay(stamps, 0, AUTO_BREAKS)
    expect(r.deltaMinutes).toBeNull()
  })

  it('overtime day: positive delta', () => {
    // 10h work − 1h auto-break = 9h = +45min delta
    const stamps = [stamp('07:00', 'in'), stamp('17:00', 'out')] // 600min raw
    const r = calculateDay(stamps, TARGET, AUTO_BREAKS)
    expect(r.totalMinutes).toBe(540) // 600 − 60
    expect(r.deltaMinutes).toBe(45)  // 540 − 495
  })
})
