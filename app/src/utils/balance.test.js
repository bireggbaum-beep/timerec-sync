import { describe, it, expect } from 'vitest'
import { calculateBalance } from './balance.js'

const stamp = (time, action) => ({ time, action, taskId: 1, taskName: 'Test', comment: '' })

const TEST_CONFIG = {
  workSchedule: {
    dailyTargetTime: '08:15',
    weekdayTargets: {
      sunday: '00:00', monday: '08:15', tuesday: '08:15',
      wednesday: '08:15', thursday: '08:15', friday: '08:15', saturday: '00:00',
    },
    firstDayOfWeek: 'monday',
  },
  autoBreaks: {
    enabled: true,
    validateActual: false,
    evalOrder: 'highestThreshold',
    rules: [
      { afterWorkTime: '05:00', breakDuration: '00:30', enabled: true },
      { afterWorkTime: '08:00', breakDuration: '00:45', enabled: true },
      { afterWorkTime: '10:00', breakDuration: '01:00', enabled: true },
    ],
  },
}

// Mon–Fri 2024-01-15 to 2024-01-19
const WORKWEEK = ['2024-01-15','2024-01-16','2024-01-17','2024-01-18','2024-01-19']
const FULL_WEEK = [...WORKWEEK, '2024-01-20', '2024-01-21']

describe('calculateBalance', () => {
  it('zero balance when every day hits target exactly', () => {
    // 9h (540min) − 45min auto-break = 495min = target
    const stampsMap = {}
    for (const d of WORKWEEK) stampsMap[d] = [stamp('08:00', 'in'), stamp('17:00', 'out')]
    const { totalDeltaMinutes } = calculateBalance(FULL_WEEK, stampsMap, {}, TEST_CONFIG)
    expect(totalDeltaMinutes).toBe(0)
  })

  it('accumulates positive delta for overtime', () => {
    // 10h (600min) − 60min auto-break = 540min → +45min per day
    const stampsMap = {}
    for (const d of WORKWEEK) stampsMap[d] = [stamp('07:00', 'in'), stamp('17:00', 'out')]
    const { totalDeltaMinutes, entries } = calculateBalance(WORKWEEK, stampsMap, {}, TEST_CONFIG)
    expect(totalDeltaMinutes).toBe(45 * 5)
    expect(entries[4].cumulativeDelta).toBe(45 * 5)
  })

  it('skips weekend days', () => {
    const stampsMap = {
      '2024-01-20': [stamp('10:00', 'in'), stamp('12:00', 'out')], // Saturday
    }
    const { entries } = calculateBalance(FULL_WEEK, stampsMap, {}, TEST_CONFIG)
    expect(entries.every(e => e.date !== '2024-01-20')).toBe(true)
    expect(entries.every(e => e.date !== '2024-01-21')).toBe(true)
  })

  it('skips future days with no stamps', () => {
    const { entries, totalDeltaMinutes } = calculateBalance(WORKWEEK, {}, {}, TEST_CONFIG)
    expect(entries).toHaveLength(0)
    expect(totalDeltaMinutes).toBe(0)
  })

  it('absence counts as target (0 delta)', () => {
    // Mon = Urlaub (0 delta), Tue–Fri = 9h each (0 delta each)
    const stampsMap = {}
    const absenceMap = { '2024-01-15': 'urlaub' }
    for (const d of WORKWEEK.slice(1)) {
      stampsMap[d] = [stamp('08:00', 'in'), stamp('17:00', 'out')]
    }
    const { entries, totalDeltaMinutes } = calculateBalance(
      WORKWEEK, stampsMap, absenceMap, TEST_CONFIG
    )
    const vacEntry = entries.find(e => e.date === '2024-01-15')
    expect(vacEntry.absence).toBe('urlaub')
    expect(vacEntry.deltaMinutes).toBe(0)
    expect(totalDeltaMinutes).toBe(0)
  })

  it('cumulative delta tracks correctly across multiple days', () => {
    // Day 1: 10h − 60min = 540min → +45min
    // Day 2: 10h − 60min = 540min → +45min (cum: 90)
    // Day 3:  9h − 45min = 495min →   0min (cum: 90)
    // Day 4: 08:30–16:00 = 450min − 30min = 420min → −75min (cum: 15)
    // Day 5:  9h − 45min = 495min →   0min (cum: 15)
    const stampsMap = {
      '2024-01-15': [stamp('07:00', 'in'), stamp('17:00', 'out')],
      '2024-01-16': [stamp('07:00', 'in'), stamp('17:00', 'out')],
      '2024-01-17': [stamp('08:00', 'in'), stamp('17:00', 'out')],
      '2024-01-18': [stamp('08:30', 'in'), stamp('16:00', 'out')],
      '2024-01-19': [stamp('08:00', 'in'), stamp('17:00', 'out')],
    }
    const { entries } = calculateBalance(WORKWEEK, stampsMap, {}, TEST_CONFIG)
    expect(entries[0].cumulativeDelta).toBe(45)
    expect(entries[1].cumulativeDelta).toBe(90)
    expect(entries[2].cumulativeDelta).toBe(90)
    expect(entries[3].cumulativeDelta).toBe(15)
    expect(entries[4].cumulativeDelta).toBe(15)
  })
})
