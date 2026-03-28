import db from './index.js'

export async function importFromJson({ config, tasks, stamps }) {
  const docs = []

  // Config → _id: 'config'
  docs.push({ _id: 'config', type: 'config', ...config })

  // Tasks → _id: 'task::1'
  for (const t of tasks) {
    docs.push({ _id: `task::${t.id}`, type: 'task', ...t })
  }

  // Stamps → _id: 'stamp::2024-01-15::001'
  for (const s of stamps) {
    docs.push({
      _id: `stamp::${s.date}::${String(s.seqNr).padStart(3, '0')}`,
      type: 'stamp',
      date: s.date,
      time: s.time,
      action: s.action,
      taskId: s.taskId,
      taskName: s.taskName,
      comment: s.comment || '',
    })
  }

  // Idempotent: nur fehlende Dokumente einfügen
  const existing = await db.allDocs({ keys: docs.map(d => d._id) })
  const existingIds = new Set(existing.rows.filter(r => r.value).map(r => r.id))
  const toInsert = docs.filter(d => !existingIds.has(d._id))

  if (toInsert.length) await db.bulkDocs(toInsert)
  return { imported: toInsert.length, skipped: docs.length - toInsert.length, total: docs.length }
}

export async function fetchAndImport() {
  const [config, tasks, stamps] = await Promise.all([
    fetch('/data/config.json').then(r => r.json()),
    fetch('/data/tasks.json').then(r => r.json()),
    fetch('/data/stamps.json').then(r => r.json()),
  ])
  return importFromJson({ config, tasks, stamps })
}
