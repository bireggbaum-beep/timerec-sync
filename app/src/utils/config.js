import { timeToMin } from './time.js'

const WEEKDAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
]

export const DEFAULT_CONFIG = {
  workSchedule: {
    dailyTargetTime: '08:15',
    weekdayTargets: {
      sunday:    '00:00',
      monday:    '08:15',
      tuesday:   '08:15',
      wednesday: '08:15',
      thursday:  '08:15',
      friday:    '08:15',
      saturday:  '00:00',
    },
    firstDayOfWeek: 'monday',
    flextimeYear: null,
  },
  autoPunchOut: {
    enabled: true,
    time: '20:00',
  },
  autoBreaks: {
    enabled: true,
    validateActual: true,
    evalOrder: 'highestThreshold',
    rules: [
      { afterWorkTime: '05:00', breakDuration: '00:30', enabled: true },
      { afterWorkTime: '08:00', breakDuration: '00:45', enabled: false },
      { afterWorkTime: '10:00', breakDuration: '01:00', enabled: false },
    ],
  },
  overtime: {
    trackingEnabled: true,
    showDailyDelta: true,
    showWeeklyDelta: true,
    highlightThresholdHours: 2,
  },
  display: {
    workDayStart: '07:00',
    workDayEnd: '20:00',
    showIsoWeek: true,
    breakDetails: true,
  },
  standardBreaks: [],
}

/**
 * Merge a partial config from PouchDB with the defaults.
 * Missing keys fall back to DEFAULT_CONFIG values.
 */
export function resolveConfig(stored) {
  if (!stored) return DEFAULT_CONFIG
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    workSchedule:  { ...DEFAULT_CONFIG.workSchedule,  ...stored.workSchedule },
    autoPunchOut:  { ...DEFAULT_CONFIG.autoPunchOut,  ...stored.autoPunchOut },
    autoBreaks:    { ...DEFAULT_CONFIG.autoBreaks,    ...stored.autoBreaks },
    overtime:      { ...DEFAULT_CONFIG.overtime,      ...stored.overtime },
    display:       { ...DEFAULT_CONFIG.display,       ...stored.display },
  }
}

/**
 * Target minutes for a given date string ("2024-01-15").
 * Uses per-weekday override if set, otherwise dailyTargetTime.
 * Note: new Date('2024-01-15') parses as UTC midnight → use noon to avoid
 *       DST edge cases shifting the day.
 */
export function targetMinutesForDate(dateStr, config) {
  const cfg = resolveConfig(config)
  const dayIndex = new Date(dateStr + 'T12:00:00').getDay()
  const name = WEEKDAY_NAMES[dayIndex]
  const timeStr =
    cfg.workSchedule.weekdayTargets?.[name] ??
    cfg.workSchedule.dailyTargetTime
  return timeToMin(timeStr)
}

/** Convenience: is this date a working day (target > 0)? */
export function isWorkday(dateStr, config) {
  return targetMinutesForDate(dateStr, config) > 0
}

/** Auto-breaks config with fallback */
export function getAutoBreaks(config) {
  return resolveConfig(config).autoBreaks
}
