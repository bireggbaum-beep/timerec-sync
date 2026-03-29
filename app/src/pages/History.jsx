import { useState, useEffect, useCallback } from 'react'
import { calculateDay } from '../utils/workday.js'
import { targetMinutesForDate, getAutoBreaks, resolveConfig } from '../utils/config.js'
import { formatMinutes } from '../utils/time.js'
import { getConfig, getDay, saveDay, getStampsForDay, getDaysInRange } from '../db/documents.js'

const DAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const DEFAULT_TEMPLATES = [
  { id: 1001, name: 'Urlaub' },
  { id: 1002, name: 'Kompensation' },
  { id: 1003, name: 'Feiertag' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthDates(year, month) {
  const days = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days.reverse() // newest first
}

function DeltaBadge({ minutes }) {
  if (minutes === null) return <span className="text-gray-300 font-mono text-sm">—</span>
  const cls = minutes >= 0 ? 'text-green-600' : 'text-red-500'
  const sign = minutes >= 0 ? '+' : ''
  return <span className={`${cls} font-mono text-sm`}>{sign}{formatMinutes(minutes)}</span>
}

// ── Expandierter Tag ──────────────────────────────────────────────────────────

function DayDetail({ date, dayDoc, config, onDayDocChange }) {
  const [stamps, setStamps] = useState(null)
  const [note, setNote] = useState(dayDoc?.note ?? '')
  const [saving, setSaving] = useState(false)
  const templates = config?.dayTemplates ?? DEFAULT_TEMPLATES
  const absenceId = dayDoc?.absenceTemplateId ?? null

  useEffect(() => {
    getStampsForDay(date).then(setStamps)
  }, [date])

  async function saveNote() {
    if (note === (dayDoc?.note ?? '')) return
    setSaving(true)
    const updated = await saveDay(date, { ...dayDoc, note })
    onDayDocChange({ ...dayDoc, note, _id: `day::${date}`, type: 'day', date })
    setSaving(false)
  }

  async function setAbsence(templateId) {
    const id = templateId ? Number(templateId) : null
    await saveDay(date, { absenceTemplateId: id })
    onDayDocChange({ ...dayDoc, absenceTemplateId: id, _id: `day::${date}`, type: 'day', date })
  }

  const autoBreaks = getAutoBreaks(config)
  const target = targetMinutesForDate(date, config)
  const result = stamps ? calculateDay(stamps, target, autoBreaks) : null

  return (
    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 bg-gray-50">
      {/* Abwesenheit */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20">Abwesenheit</span>
        <select
          value={absenceId ?? ''}
          onChange={e => setAbsence(e.target.value || null)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
        >
          <option value="">—</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Stempelliste */}
      {!absenceId && (
        <div>
          {stamps === null && <p className="text-xs text-gray-400">Lade…</p>}
          {stamps?.length === 0 && <p className="text-xs text-gray-400">Keine Stempel</p>}
          {result?.events?.length > 0 && (
            <div className="space-y-1">
              {result.events.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-gray-700 w-12">{ev.kommt}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-mono text-gray-700 w-12">{ev.geht ?? '…'}</span>
                  {ev.durationMinutes != null && (
                    <span className="text-gray-400 text-xs">{formatMinutes(ev.durationMinutes)}</span>
                  )}
                  {ev.taskName && (
                    <span className="text-xs text-gray-500 truncate">{ev.taskName}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {result?.autoBreakDeduction > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Auto-Pause: −{formatMinutes(result.autoBreakDeduction)}
            </p>
          )}
        </div>
      )}

      {/* Notiz */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 w-20 pt-1.5">Notiz</span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={saveNote}
          rows={2}
          placeholder="Notiz zum Tag…"
          className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 resize-none bg-white"
        />
        {saving && <span className="text-xs text-gray-400 self-center">…</span>}
      </div>
    </div>
  )
}

// ── Tages-Zeile ──────────────────────────────────────────────────────────────

function DayRow({ date, dayDoc, config, onDayDocChange }) {
  const [expanded, setExpanded] = useState(false)
  const today = todayStr()
  const isFuture = date > today
  const isToday = date === today

  const target = targetMinutesForDate(date, config)
  const isWeekend = target === 0
  const absenceId = dayDoc?.absenceTemplateId ?? null
  const templates = config?.dayTemplates ?? DEFAULT_TEMPLATES
  const absenceName = absenceId ? templates.find(t => t.id === absenceId)?.name : null

  // For display we need stamps only if expanded — but for the row summary we
  // show computed values which requires stamps. We accept that non-expanded rows
  // show placeholder until stamps load. Use cached result via dayDoc augmentation.
  const [rowResult, setRowResult] = useState(null)

  useEffect(() => {
    if (isFuture || isWeekend || absenceId) return
    getStampsForDay(date).then(stamps => {
      const autoBreaks = getAutoBreaks(config)
      setRowResult(calculateDay(stamps, target, autoBreaks))
    })
  }, [date, config, absenceId])

  const d = new Date(date + 'T12:00:00')
  const dayName = DAYS_DE[d.getDay()]
  const dayNum = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`

  let ist = null
  let delta = null
  if (absenceId) {
    ist = null // shows absence badge instead
    delta = 0
  } else if (rowResult) {
    ist = rowResult.totalMinutes
    delta = rowResult.deltaMinutes
  }

  const rowCls = [
    'flex items-center gap-2 px-4 py-3 cursor-pointer select-none',
    isToday ? 'bg-blue-50' : 'hover:bg-gray-50',
    isFuture || isWeekend ? 'opacity-50' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className={rowCls} onClick={() => !isFuture && setExpanded(e => !e)}>
        {/* Chevron */}
        <span className={`text-gray-400 text-xs transition-transform w-3 ${expanded ? 'rotate-90' : ''} ${isFuture ? 'invisible' : ''}`}>
          ▶
        </span>

        {/* Datum */}
        <span className="flex items-baseline gap-1.5 w-28">
          <span className="text-xs font-medium text-gray-500 w-5">{dayName}</span>
          <span className="text-sm text-gray-700 font-mono">{dayNum}</span>
        </span>

        {/* Ist */}
        <span className="flex-1 font-mono text-sm text-gray-700">
          {absenceName
            ? <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{absenceName}</span>
            : isWeekend || isFuture ? <span className="text-gray-300">—</span>
            : ist != null ? formatMinutes(ist) : <span className="text-gray-300">…</span>}
        </span>

        {/* Soll */}
        <span className="font-mono text-sm text-gray-400 w-16 text-right">
          {isWeekend ? <span className="text-gray-200">—</span> : formatMinutes(target)}
        </span>

        {/* Delta */}
        <span className="w-20 text-right">
          {isWeekend || isFuture
            ? <span className="text-gray-200">—</span>
            : <DeltaBadge minutes={delta} />}
        </span>
      </div>

      {expanded && !isFuture && (
        <DayDetail
          date={date}
          dayDoc={dayDoc}
          config={config}
          onDayDocChange={onDayDocChange}
        />
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function History() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [config, setConfig] = useState(null)
  const [dayDocs, setDayDocs] = useState({}) // { date: dayDoc }

  useEffect(() => {
    getConfig().then(stored => setConfig(resolveConfig(stored)))
  }, [])

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    getDaysInRange(from, to).then(docs => {
      const map = {}
      docs.forEach(d => { map[d.date] = d })
      setDayDocs(map)
    })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dates = config ? monthDates(year, month) : []

  const handleDayDocChange = useCallback((doc) => {
    setDayDocs(prev => ({ ...prev, [doc.date]: doc }))
  }, [])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg">←</button>
        <div className="text-center">
          <span className="font-medium text-gray-800">{MONTHS_DE[month - 1]} {year}</span>
          {!isCurrentMonth && (
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }}
              className="ml-3 text-xs text-blue-600 hover:underline"
            >
              heute
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg">→</button>
      </div>

      {/* Column headers */}
      <div className="grid text-xs text-gray-400 font-medium px-4 pb-1" style={{ gridTemplateColumns: '1rem 7rem 1fr 4rem 5rem' }}>
        <span />
        <span>Tag</span>
        <span>Ist</span>
        <span className="text-right">Soll</span>
        <span className="text-right">Delta</span>
      </div>

      {/* Day list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {!config && <div className="text-center text-gray-400 py-8 text-sm">Lade…</div>}
        {config && dates.map(date => (
          <DayRow
            key={date}
            date={date}
            dayDoc={dayDocs[date] ?? null}
            config={config}
            onDayDocChange={handleDayDocChange}
          />
        ))}
      </div>
    </div>
  )
}
