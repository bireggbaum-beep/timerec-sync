/** "08:30" → 510 */
export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 510 → "08:30" */
export function minToTime(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 510 → "8h 30m" */
export function formatMinutes(min, decimal = false) {
  if (min === null || min === undefined) return '—'
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : ''
  if (decimal) {
    return `${sign}${(Math.abs(min) / 60).toFixed(2).replace('.', ',')}`
  }
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`
}

/** "2024-01-15" → Date (local) */
export function parseDate(str) {
  const [y, mo, d] = str.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

/** Date → "2024-01-15" */
export function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

/** ISO week number */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}
