/**
 * Dokument-Typen und ID-Konventionen
 *
 * config          → _id: 'config'
 * task            → _id: 'task::1'
 * day             → _id: 'day::2024-01-15'
 * stamp           → _id: 'stamp::2024-01-15::001'
 */

import db from './index'

// ── Config ────────────────────────────────────────────────

export async function getConfig() {
  try {
    return await db.get('config')
  } catch {
    return null
  }
}

export async function saveConfig(data) {
  const existing = await getConfig()
  return db.put({ ...existing, ...data, _id: 'config', type: 'config' })
}

// ── Tasks ─────────────────────────────────────────────────

export async function getTasks() {
  const result = await db.find({ selector: { type: 'task' } })
  return result.docs.sort((a, b) => a.sortNr - b.sortNr)
}

export async function saveTask(task) {
  const id = `task::${task.id}`
  try {
    const existing = await db.get(id)
    return db.put({ ...existing, ...task, _id: id, type: 'task' })
  } catch {
    return db.put({ ...task, _id: id, type: 'task' })
  }
}

// ── Days ──────────────────────────────────────────────────

export async function getDay(date) {
  try {
    return await db.get(`day::${date}`)
  } catch {
    return { _id: `day::${date}`, type: 'day', date, note: '', missingCheckout: false }
  }
}

export async function saveDay(date, data) {
  const existing = await getDay(date)
  return db.put({ ...existing, ...data, _id: `day::${date}`, type: 'day', date })
}

export async function getDaysInRange(from, to) {
  const result = await db.find({
    selector: { type: 'day', date: { $gte: from, $lte: to } },
    sort: [{ type: 'asc' }, { date: 'asc' }],
  })
  return result.docs
}

// ── Stamps ────────────────────────────────────────────────

export async function getStampsForDay(date) {
  const result = await db.find({
    selector: { type: 'stamp', date },
    sort: [{ type: 'asc' }, { date: 'asc' }],
  })
  return result.docs.sort((a, b) => a.time.localeCompare(b.time))
}

export async function addStamp({ date, time, action, taskId, taskName, comment = '' }) {
  const existing = await getStampsForDay(date)
  const seqNr = (existing.length + 1).toString().padStart(3, '0')
  const id = `stamp::${date}::${seqNr}`
  return db.put({ _id: id, type: 'stamp', date, time, action, taskId, taskName, comment })
}

export async function updateStamp(stamp) {
  return db.put(stamp)
}

export async function deleteStamp(stamp) {
  return db.remove(stamp)
}

// ── Punch In / Out (Hauptaktion) ──────────────────────────

export async function punch({ taskId, taskName, comment = '' }) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5)

  const stamps = await getStampsForDay(date)
  const lastStamp = stamps[stamps.length - 1]
  const action = (!lastStamp || lastStamp.action === 'out') ? 'in' : 'out'

  await addStamp({ date, time, action, taskId, taskName, comment })
  return { action, time }
}

export async function applyBreak(date, outTime, inTime) {
  const existing = await getStampsForDay(date)
  const base = existing.length + 1
  await db.bulkDocs([
    { _id: `stamp::${date}::${String(base).padStart(3, '0')}`,
      type: 'stamp', date, time: outTime, action: 'out', taskId: null, taskName: null, comment: '' },
    { _id: `stamp::${date}::${String(base + 1).padStart(3, '0')}`,
      type: 'stamp', date, time: inTime, action: 'in', taskId: null, taskName: null, comment: '' },
  ])
}

export async function isCurrentlyIn() {
  const today = new Date().toISOString().slice(0, 10)
  const stamps = await getStampsForDay(today)
  const last = stamps[stamps.length - 1]
  return last?.action === 'in' ? last : null
}
