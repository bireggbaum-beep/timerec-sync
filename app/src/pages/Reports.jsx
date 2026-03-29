import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calculateDay } from '../utils/workday.js'
import { targetMinutesForDate, getAutoBreaks, resolveConfig } from '../utils/config.js'
import { formatMinutes } from '../utils/time.js'
import { getConfig, getStampsForDay } from '../db/documents.js'

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0') }

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

function download(filename, content, mime) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function monthDates(year, month) {
  const dates = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// ── Build month data ──────────────────────────────────────────────────────────

async function buildMonthData(year, month) {
  const storedConfig = await getConfig()
  const config = resolveConfig(storedConfig)
  const autoBreaks = getAutoBreaks(config)
  const templates = config.dayTemplates ?? [
    { id: 1001, name: 'Urlaub' },
    { id: 1002, name: 'Kompensation' },
    { id: 1003, name: 'Feiertag' },
  ]

  const dates = monthDates(year, month)
  const stampsArrays = await Promise.all(dates.map(d => getStampsForDay(d)))

  return dates.map((date, i) => {
    const stamps = stampsArrays[i]
    const target = targetMinutesForDate(date, config)
    const d = new Date(date + 'T12:00:00')
    const dayName = DAYS_DE[d.getDay()]
    const isWeekend = target === 0
    const result = calculateDay(stamps, target, autoBreaks)
    return {
      date,
      dayName,
      isWeekend,
      events: result.events,
      openSession: result.openSession,
      autoBreakDeduction: result.autoBreakDeduction,
      totalMinutes: result.totalMinutes,
      targetMinutes: result.targetMinutes,
      deltaMinutes: result.deltaMinutes,
    }
  })
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(data, year, month) {
  const BOM = '\uFEFF'
  const header = 'Datum;Wochentag;Kommt;Geht;Aufgabe;Dauer_min;Ist_min;Soll_min;Delta_min'
  const rows = []

  for (const day of data) {
    if (day.isWeekend && day.events.length === 0) continue
    if (day.events.length === 0) {
      rows.push(`${day.date};${day.dayName};;;;; ;${day.targetMinutes};${day.deltaMinutes ?? ''}`)
      continue
    }
    day.events.forEach((ev, i) => {
      const isLast = i === day.events.length - 1
      rows.push([
        day.date,
        day.dayName,
        ev.kommt,
        ev.geht ?? '',
        ev.taskName ?? '',
        ev.durationMinutes ?? '',
        isLast ? day.totalMinutes : '',
        isLast ? day.targetMinutes : '',
        isLast ? (day.deltaMinutes ?? '') : '',
      ].join(';'))
    })
  }

  const filename = `timerec-${year}-${pad2(month)}.csv`
  download(filename, BOM + [header, ...rows].join('\n'), 'text/csv;charset=utf-8')
}

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportPdf(data, year, month) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const title = `TimeRec — ${MONTHS_DE[month - 1]} ${year}`
  doc.setFontSize(14)
  doc.text(title, 14, 16)

  const tableRows = []
  for (const day of data) {
    if (day.isWeekend && day.events.length === 0) continue
    const dateStr = fmtDate(day.date)
    if (day.events.length === 0) {
      tableRows.push([
        `${day.dayName} ${dateStr}`, '—', '—', '—',
        formatMinutes(day.targetMinutes),
        day.deltaMinutes != null ? formatMinutes(day.deltaMinutes) : '—',
      ])
    } else {
      day.events.forEach((ev, i) => {
        const isLast = i === day.events.length - 1
        tableRows.push([
          i === 0 ? `${day.dayName} ${dateStr}` : '',
          ev.kommt,
          ev.geht ?? '…',
          ev.taskName ?? '',
          isLast ? formatMinutes(day.totalMinutes) : '',
          isLast && day.deltaMinutes != null ? formatMinutes(day.deltaMinutes) : '',
        ])
      })
    }
  }

  const totalMinutes = data.reduce((s, d) => s + d.totalMinutes, 0)
  const targetMinutes = data.reduce((s, d) => s + d.targetMinutes, 0)
  const deltaMinutes = totalMinutes - targetMinutes

  autoTable(doc, {
    head: [['Tag', 'Kommt', 'Geht', 'Aufgabe', 'Ist', 'Delta']],
    body: tableRows,
    foot: [['Total', '', '', '', formatMinutes(totalMinutes), formatMinutes(deltaMinutes)]],
    startY: 22,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 16 },
      2: { cellWidth: 16 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
    },
  })

  doc.save(`timerec-${year}-${pad2(month)}.pdf`)
}

// ── HTML Export ───────────────────────────────────────────────────────────────

function exportHtml(data, year, month) {
  const title = `TimeRec — ${MONTHS_DE[month - 1]} ${year}`
  const totalMinutes = data.reduce((s, d) => s + d.totalMinutes, 0)
  const targetMinutes = data.reduce((s, d) => s + d.targetMinutes, 0)
  const deltaMinutes = totalMinutes - targetMinutes

  const rows = []
  for (const day of data) {
    if (day.isWeekend && day.events.length === 0) continue
    const dateStr = fmtDate(day.date)
    if (day.events.length === 0) {
      rows.push(`<tr class="no-stamp">
        <td>${day.dayName} ${dateStr}</td><td>—</td><td>—</td><td>—</td>
        <td class="num">${formatMinutes(day.targetMinutes)}</td>
        <td class="num">${day.deltaMinutes != null ? formatMinutes(day.deltaMinutes) : '—'}</td>
      </tr>`)
    } else {
      day.events.forEach((ev, i) => {
        const isLast = i === day.events.length - 1
        const delta = isLast && day.deltaMinutes != null ? formatMinutes(day.deltaMinutes) : ''
        const deltaClass = day.deltaMinutes >= 0 ? 'pos' : 'neg'
        rows.push(`<tr>
          <td>${i === 0 ? `${day.dayName} ${dateStr}` : ''}</td>
          <td class="num">${ev.kommt}</td>
          <td class="num">${ev.geht ?? '…'}</td>
          <td>${ev.taskName ?? ''}</td>
          <td class="num">${isLast ? formatMinutes(day.totalMinutes) : ''}</td>
          <td class="num ${isLast ? deltaClass : ''}">${delta}</td>
        </tr>`)
      })
    }
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 2cm; color: #222; }
  h1 { font-size: 16px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .num { font-family: monospace; text-align: right; }
  .pos { color: #16a34a; }
  .neg { color: #dc2626; }
  .no-stamp td { color: #999; }
  tfoot td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #ccc; }
  @media print { body { margin: 1cm; } }
</style>
</head>
<body>
<h1>${title}</h1>
<table>
  <thead><tr><th>Tag</th><th>Kommt</th><th>Geht</th><th>Aufgabe</th><th>Ist</th><th>Delta</th></tr></thead>
  <tbody>${rows.join('\n')}</tbody>
  <tfoot><tr>
    <td colspan="4">Total</td>
    <td class="num">${formatMinutes(totalMinutes)}</td>
    <td class="num ${deltaMinutes >= 0 ? 'pos' : 'neg'}">${formatMinutes(deltaMinutes)}</td>
  </tr></tfoot>
</table>
</body>
</html>`

  download(`timerec-${year}-${pad2(month)}.html`, html, 'text/html;charset=utf-8')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    buildMonthData(year, month).then(d => {
      if (!cancelled) { setData(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [year, month])

  async function handleExport(type) {
    if (!data) return
    setExporting(type)
    try {
      if (type === 'csv')  exportCsv(data, year, month)
      if (type === 'pdf')  exportPdf(data, year, month)
      if (type === 'html') exportHtml(data, year, month)
    } finally {
      setExporting(null)
    }
  }

  const workdays = data?.filter(d => !d.isWeekend) ?? []
  const totalMinutes = data?.reduce((s, d) => s + d.totalMinutes, 0) ?? 0
  const targetMinutes = data?.reduce((s, d) => s + d.targetMinutes, 0) ?? 0
  const deltaMinutes = totalMinutes - targetMinutes

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg">←</button>
        <span className="font-medium text-gray-800">{MONTHS_DE[month - 1]} {year}</span>
        <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg">→</button>
      </div>

      {/* Export-Buttons */}
      <div className="flex gap-2">
        {['csv', 'pdf', 'html'].map(type => (
          <button
            key={type}
            onClick={() => handleExport(type)}
            disabled={loading || !!exporting}
            className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 uppercase font-medium"
          >
            {exporting === type ? '…' : type}
          </button>
        ))}
      </div>

      {/* Zusammenfassung */}
      {!loading && data && (
        <div className="bg-white rounded-xl shadow-sm p-4 flex gap-6 text-sm">
          <div>
            <div className="text-xs text-gray-400">Arbeitstage</div>
            <div className="font-medium">{workdays.filter(d => d.totalMinutes > 0).length} / {workdays.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Ist</div>
            <div className="font-mono font-medium">{formatMinutes(totalMinutes)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Soll</div>
            <div className="font-mono text-gray-500">{formatMinutes(targetMinutes)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Delta</div>
            <div className={`font-mono font-medium ${deltaMinutes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {deltaMinutes >= 0 ? '+' : ''}{formatMinutes(deltaMinutes)}
            </div>
          </div>
        </div>
      )}

      {/* Vorschau */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-5 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
          <span className="col-span-2">Tag</span>
          <span>Kommt–Geht</span>
          <span className="text-right">Ist</span>
          <span className="text-right">Delta</span>
        </div>

        {loading && <div className="text-center text-gray-400 py-8 text-sm">Lade…</div>}

        {!loading && data && data.filter(d => !d.isWeekend).map(day => {
          const dateStr = fmtDate(day.date)
          const hasStamps = day.events.length > 0
          return (
            <div key={day.date} className="border-b border-gray-50 last:border-0 px-4 py-2 text-sm">
              <div className="grid grid-cols-5 items-start">
                <span className="col-span-2 text-gray-600">
                  <span className="font-medium w-5 inline-block">{day.dayName}</span>
                  <span className="text-gray-400 text-xs ml-1">{dateStr}</span>
                </span>
                <span className="text-gray-500 text-xs">
                  {!hasStamps ? <span className="text-gray-300">—</span>
                    : day.events.map((ev, i) => (
                      <div key={i} className="font-mono">
                        {ev.kommt}–{ev.geht ?? '…'}
                        {ev.taskName && <span className="text-gray-400 ml-1 non-mono">{ev.taskName}</span>}
                      </div>
                    ))
                  }
                </span>
                <span className="text-right font-mono text-gray-700">
                  {hasStamps ? formatMinutes(day.totalMinutes) : <span className="text-gray-300">—</span>}
                </span>
                <span className={`text-right font-mono ${day.deltaMinutes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {!hasStamps ? <span className="text-gray-300">—</span>
                    : (day.deltaMinutes >= 0 ? '+' : '') + formatMinutes(day.deltaMinutes)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
