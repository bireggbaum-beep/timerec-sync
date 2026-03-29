import { calculateDay } from './workday.js'
import { targetMinutesForDate, isWorkday, getAutoBreaks } from './config.js'

/**
 * Calculate the cumulative flextime balance over an array of dates.
 *
 * @param {string[]} dates      — sorted date strings to include
 * @param {Object}   stampsMap  — { '2024-01-15': [stamp, ...], ... }
 * @param {Object}   absenceMap — { '2024-01-15': 'urlaub'|'feiertag'|'kompensation' }
 * @param {Object}   config     — app config (or null for defaults)
 *
 * Absence rules:
 *   'urlaub'       — counts as full target (0 delta)
 *   'feiertag'     — counts as full target (0 delta)
 *   'kompensation' — counts as full target (0 delta, reduces overtime)
 *
 * Future dates (no stamps, no absence): skipped — no negative contribution.
 *
 * Returns:
 *   entries[]         — one entry per included date
 *   totalDeltaMinutes — overall balance
 */
export function calculateBalance(dates, stampsMap, absenceMap = {}, config) {
  const autoBreaks = getAutoBreaks(config)
  let cumulative = 0
  const entries = []

  for (const date of dates) {
    const target = targetMinutesForDate(date, config)

    // Skip non-workdays (Sat/Sun with target 0)
    if (!isWorkday(date, config)) continue

    const absence = absenceMap[date] ?? null

    if (absence) {
      // Absence counts as Ist = Soll → delta 0
      cumulative += 0
      entries.push({
        date,
        absence,
        totalMinutes: target,
        targetMinutes: target,
        deltaMinutes: 0,
        cumulativeDelta: cumulative,
      })
      continue
    }

    const stamps = stampsMap[date] ?? []

    // No stamps and no absence → future or missing day, skip
    if (!stamps.length) continue

    const result = calculateDay(stamps, target, autoBreaks)
    cumulative += result.deltaMinutes ?? 0

    entries.push({
      date,
      absence: null,
      ...result,
      cumulativeDelta: cumulative,
    })
  }

  return {
    entries,
    totalDeltaMinutes: cumulative,
  }
}
