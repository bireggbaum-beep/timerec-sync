import { describe, it, expect } from 'vitest'
import { weekStart, weekDates, calculateWeek } from './week.js'

const stamp = (time, action) => ({ time, action, taskId: 1, taskName: 'Test', comment: '' })

// Explicit test config: all 3 auto-break rules active, validateActual: false
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

describe('weekStart', () => {
  it('returns Monday for a Wednesday', () => {
    const mon = weekStart(new Date('2024-01-17')) // Wednesday
    expect(mon.toISOString().slice(0, 10)).toBe('2024-01-15')
  })

  it('returns same Monday for a Monday', () => {
    const mon = weekStart(new Date('2024-01-15'))
    expect(mon.toISOString().slice(0, 10)).toBe('2024-01-15')
  })

  it('returns previous Monday for a Sunday', () => {
    const mon = weekStart(new Date('2024-01-21')) // Sunday
    expect(mon.toISOString().slice(0, 10)).toBe('2024-01-15')
  })
})

describe('weekDates', () => {
  it('returns 7 dates starting on Monday', () => {
    const dates = weekDates('2024-01-17') // Wednesday
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2024-01-15') // Mon
    expect(dates[6]).toBe('2024-01-21') // Sun
  })
})

describe('calculateWeek', () => {
  it('sums up days correctly', () => {
    // Mon–Fri each 9h (540min), auto-break 45min → 495min = target. Sat/Sun empty.
    const stampsMap = {}
    for (const date of ['2024-01-15','2024-01-16','2024-01-17','2024-01-18','2024-01-19']) {
      stampsMap[date] = [stamp('08:00', 'in'), stamp('17:00', 'out')]
    }

    const week = calculateWeek('2024-01-17', stampsMap, TEST_CONFIG)

    expect(week.weekNumber).toBe(3)
    expect(week.dates[0]).toBe('2024-01-15')
    // 9h (540min) − 45min auto-break = 495min = target → delta 0
    expect(week.totalMinutes).toBe(495 * 5)
    expect(week.targetMinutes).toBe(495 * 5)
    expect(week.deltaMinutes).toBe(0)
  })

  it('handles missing days as zero', () => {
    const week = calculateWeek('2024-01-17', {}, TEST_CONFIG)
    expect(week.totalMinutes).toBe(0)
    expect(week.deltaMinutes).toBe(-(495 * 5)) // 5 workdays all missed
  })

  it('correctly identifies week number', () => {
    const week = calculateWeek('2024-01-01', {}, null) // KW1 2024
    expect(week.weekNumber).toBe(1)
  })
})
