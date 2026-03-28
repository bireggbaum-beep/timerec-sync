import { timeToMin } from './time.js'

/**
 * Pair sorted stamps into events [{kommt, geht, durationMinutes, ...}]
 *
 * Rules:
 * - in + out → closed event
 * - in without following out → open event (geht: null, durationMinutes: null)
 * - orphan out → skipped
 * - two consecutive ins → first becomes open event, second processed next iteration
 */
export function pairStamps(stamps) {
  const sorted = [...stamps].sort((a, b) => a.time.localeCompare(b.time))
  const events = []
  let i = 0

  while (i < sorted.length) {
    const s = sorted[i]

    if (s.action !== 'in') {
      i++
      continue // orphan out
    }

    const next = sorted[i + 1]

    if (next?.action === 'out') {
      const duration = timeToMin(next.time) - timeToMin(s.time)
      events.push({
        kommt: s.time,
        geht: next.time,
        taskId: s.taskId ?? null,
        taskName: s.taskName ?? null,
        comment: s.comment ?? '',
        durationMinutes: Math.max(0, duration),
      })
      i += 2
    } else {
      // open session or consecutive in
      events.push({
        kommt: s.time,
        geht: null,
        taskId: s.taskId ?? null,
        taskName: s.taskName ?? null,
        comment: s.comment ?? '',
        durationMinutes: null,
      })
      i++
    }
  }

  return events
}

/**
 * Sum of all gaps between a geht and the next kommt (explicit break time)
 */
export function explicitBreakMinutes(events) {
  let total = 0
  for (let i = 0; i < events.length - 1; i++) {
    const cur = events[i]
    const nxt = events[i + 1]
    if (cur.geht && nxt.kommt) {
      total += Math.max(0, timeToMin(nxt.kommt) - timeToMin(cur.geht))
    }
  }
  return total
}

/**
 * Apply auto-break rules to raw worked minutes.
 *
 * evalOrder:
 *   'highestThreshold' — highest rule whose threshold is met (most common)
 *   'firstMatch'       — first rule whose threshold is met
 *
 * validateActual:
 *   true  — deduction = max(0, ruleDuration − explicitBreakMin)
 *           (only deduct what the person didn't already take as explicit break)
 *   false — always deduct full ruleDuration
 *
 * Returns { deductionMinutes, ruleApplied }
 */
export function applyAutoBreaks(rawMinutes, explicitBreakMin, autoBreaks) {
  if (!autoBreaks?.enabled || !autoBreaks.rules?.length) {
    return { deductionMinutes: 0, ruleApplied: null }
  }

  const active = autoBreaks.rules.filter(r => r.enabled)
  if (!active.length) return { deductionMinutes: 0, ruleApplied: null }

  const sorted = [...active].sort(
    (a, b) => timeToMin(a.afterWorkTime) - timeToMin(b.afterWorkTime)
  )

  let matched = null

  if (autoBreaks.evalOrder === 'highestThreshold') {
    for (const rule of sorted) {
      if (rawMinutes >= timeToMin(rule.afterWorkTime)) matched = rule
    }
  } else {
    matched = sorted.find(r => rawMinutes >= timeToMin(r.afterWorkTime)) ?? null
  }

  if (!matched) return { deductionMinutes: 0, ruleApplied: null }

  const ruleDuration = timeToMin(matched.breakDuration)

  const deduction = autoBreaks.validateActual
    ? Math.max(0, ruleDuration - explicitBreakMin)
    : ruleDuration

  return { deductionMinutes: deduction, ruleApplied: matched }
}

/**
 * Full day calculation from raw stamps + config values.
 *
 * Returns:
 *   events              — paired kommt/geht list
 *   openSession         — true if last stamp is an unclosed 'in'
 *   rawMinutes          — sum of closed event durations (before break deduction)
 *   autoBreakDeduction  — minutes deducted by auto-break rules
 *   autoBreakRule       — afterWorkTime of matched rule, or null
 *   totalMinutes        — net worked minutes (raw − autoBreakDeduction)
 *   targetMinutes       — expected minutes for this day
 *   deltaMinutes        — totalMinutes − targetMinutes (null if targetMinutes = 0)
 */
export function calculateDay(stamps, targetMinutes, autoBreaks) {
  if (!stamps?.length) {
    return {
      events: [],
      openSession: false,
      rawMinutes: 0,
      autoBreakDeduction: 0,
      autoBreakRule: null,
      totalMinutes: 0,
      targetMinutes: targetMinutes ?? 0,
      deltaMinutes: targetMinutes > 0 ? -targetMinutes : null,
    }
  }

  const events = pairStamps(stamps)
  const openSession = events.some(e => e.geht === null)
  const closed = events.filter(e => e.geht !== null)

  const rawMinutes = closed.reduce((sum, e) => sum + e.durationMinutes, 0)
  const explicit = explicitBreakMinutes(events)

  const { deductionMinutes, ruleApplied } = applyAutoBreaks(
    rawMinutes, explicit, autoBreaks
  )

  const totalMinutes = Math.max(0, rawMinutes - deductionMinutes)
  const target = targetMinutes ?? 0

  return {
    events,
    openSession,
    rawMinutes,
    autoBreakDeduction: deductionMinutes,
    autoBreakRule: ruleApplied?.afterWorkTime ?? null,
    totalMinutes,
    targetMinutes: target,
    deltaMinutes: target > 0 ? totalMinutes - target : null,
  }
}
