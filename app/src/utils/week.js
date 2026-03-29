import { toDateStr, isoWeek } from './time.js'
import { calculateDay } from './workday.js'
import { targetMinutesForDate, getAutoBreaks } from './config.js'

/**
 * Return the Monday of the ISO week containing `date`.
 */
export function weekStart(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Return array of 7 date strings [Mon … Sun] for the week containing dateStr.
 */
export function weekDates(dateStr) {
  const monday = weekStart(new Date(dateStr + 'T12:00:00'))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateStr(d)
  })
}

/**
 * Calculate a full week from a stamps map.
 *
 * @param {string}   dateStr   — any date inside the target week
 * @param {Object}   stampsMap — { '2024-01-15': [stamp, ...], ... }
 * @param {Object}   config    — app config (or null for defaults)
 *
 * Returns:
 *   weekNumber   — ISO week number
 *   year         — year of Monday
 *   dates        — ['2024-01-15', …]  (Mon–Sun)
 *   days         — array of calculateDay results, one per date
 *   totalMinutes
 *   targetMinutes
 *   deltaMinutes
 */
export function calculateWeek(dateStr, stampsMap, config) {
  const dates = weekDates(dateStr)
  const autoBreaks = getAutoBreaks(config)

  const days = dates.map(date => {
    const stamps = stampsMap[date] ?? []
    const target = targetMinutesForDate(date, config)
    return { date, ...calculateDay(stamps, target, autoBreaks) }
  })

  const totalMinutes  = days.reduce((s, d) => s + d.totalMinutes, 0)
  const targetMinutes = days.reduce((s, d) => s + d.targetMinutes, 0)

  return {
    weekNumber:   isoWeek(new Date(dates[0] + 'T12:00:00')),
    year:         new Date(dates[0] + 'T12:00:00').getFullYear(),
    dates,
    days,
    totalMinutes,
    targetMinutes,
    deltaMinutes: totalMinutes - targetMinutes,
  }
}
