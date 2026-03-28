import { describe, it, expect } from 'vitest'
import { targetMinutesForDate, isWorkday, resolveConfig, DEFAULT_CONFIG } from './config.js'

describe('targetMinutesForDate', () => {
  it('returns 495 (8h15m) for a Monday with default config', () => {
    expect(targetMinutesForDate('2024-01-15', null)).toBe(495) // Monday
  })

  it('returns 0 for Saturday', () => {
    expect(targetMinutesForDate('2024-01-20', null)).toBe(0) // Saturday
  })

  it('returns 0 for Sunday', () => {
    expect(targetMinutesForDate('2024-01-21', null)).toBe(0) // Sunday
  })

  it('respects custom weekday override', () => {
    const config = {
      workSchedule: {
        dailyTargetTime: '08:00',
        weekdayTargets: { friday: '04:00' },
      },
    }
    expect(targetMinutesForDate('2024-01-19', config)).toBe(240) // Friday = 4h
  })

  it('falls back to dailyTargetTime if weekday not in targets', () => {
    const config = {
      workSchedule: {
        dailyTargetTime: '07:30',
        weekdayTargets: {},
      },
    }
    expect(targetMinutesForDate('2024-01-15', config)).toBe(450) // 7h30m
  })
})

describe('isWorkday', () => {
  it('Monday is a workday', () => {
    expect(isWorkday('2024-01-15', null)).toBe(true)
  })

  it('Saturday is not a workday', () => {
    expect(isWorkday('2024-01-20', null)).toBe(false)
  })
})

describe('resolveConfig', () => {
  it('returns defaults for null', () => {
    expect(resolveConfig(null)).toEqual(DEFAULT_CONFIG)
  })

  it('merges partial config without losing defaults', () => {
    const partial = { display: { showIsoWeek: false } }
    const resolved = resolveConfig(partial)
    expect(resolved.display.showIsoWeek).toBe(false)
    expect(resolved.display.workDayStart).toBe('07:00') // default preserved
    expect(resolved.autoBreaks).toEqual(DEFAULT_CONFIG.autoBreaks) // untouched
  })
})
