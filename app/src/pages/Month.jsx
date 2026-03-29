import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { weekDates, weekStart, calculateWeek } from '../utils/week.js'
import { formatMinutes } from '../utils/time.js'
import { resolveConfig } from '../utils/config.js'
import { getConfig, getStampsForDay } from '../db/documents.js'

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthDateRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

/** All unique week-Monday strings for weeks overlapping with the given month */
function weeksForMonth(year, month) {
  const { from, to } = monthDateRange(year, month)
  const seen = new Set()
  const result = []
  const d = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (d <= end) {
    const mon = weekStart(new Date(d))
    const monStr = mon.toISOString().slice(0, 10)
    if (!seen.has(monStr)) {
      seen.add(monStr)
      result.push(monStr)
    }
    d.setDate(d.getDate() + 1)
  }
  return result
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`
}

function DeltaCell({ minutes }) {
  if (minutes === null) return <span className="text-gray-300">—</span>
  const cls = minutes >= 0 ? 'text-green-600' : 'text-red-500'
  const sign = minutes >= 0 ? '+' : ''
  return <span className={cls}>{sign}{formatMinutes(minutes)}</span>
}

function fmtHours(minutes) {
  // For chart tooltip: "8,25h"
  return (minutes / 60).toFixed(1).replace('.', ',') + 'h'
}

export default function Month() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)

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
    async function load() {
      setLoading(true)
      const storedConfig = await getConfig()
      const config = resolveConfig(storedConfig)
      const weekMondays = weeksForMonth(year, month)

      // Collect all dates across all weeks (may overlap)
      const allDates = new Set()
      weekMondays.forEach(mon => weekDates(mon).forEach(d => allDates.add(d)))

      // Load all stamps in parallel
      const dateArr = [...allDates]
      const stampsArrays = await Promise.all(dateArr.map(d => getStampsForDay(d)))
      if (cancelled) return

      const stampsMap = {}
      dateArr.forEach((d, i) => { stampsMap[d] = stampsArrays[i] })

      const weekResults = weekMondays.map(mon => {
        const w = calculateWeek(mon, stampsMap, config)
        const dates = weekDates(mon)
        return {
          ...w,
          label: `KW ${w.weekNumber}`,
          range: `${fmtShort(dates[0])}–${fmtShort(dates[4])}`, // Mo–Fr
          istH: +(w.totalMinutes / 60).toFixed(2),
          sollH: +(w.targetMinutes / 60).toFixed(2),
        }
      })

      setWeeks(weekResults)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [year, month])

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const totalMinutes = weeks.reduce((s, w) => s + w.totalMinutes, 0)
  const targetMinutes = weeks.reduce((s, w) => s + w.targetMinutes, 0)
  const deltaMinutes = totalMinutes - targetMinutes

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

      {/* Tabelle */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
          <span>Woche</span>
          <span className="text-right">Ist</span>
          <span className="text-right">Soll</span>
          <span className="text-right">Delta</span>
        </div>

        {loading && <div className="text-center text-gray-400 py-8 text-sm">Lade…</div>}

        {!loading && weeks.map(w => (
          <div key={w.weekNumber} className="grid grid-cols-4 px-4 py-3 border-b border-gray-50 text-sm last:border-0">
            <span>
              <span className="font-medium text-gray-700">KW {w.weekNumber}</span>
              <span className="block text-xs text-gray-400">{w.range}</span>
            </span>
            <span className="text-right font-mono text-gray-700 self-center">{formatMinutes(w.totalMinutes)}</span>
            <span className="text-right font-mono text-gray-400 self-center">{formatMinutes(w.targetMinutes)}</span>
            <span className="text-right font-mono self-center"><DeltaCell minutes={w.deltaMinutes} /></span>
          </div>
        ))}

        {!loading && (
          <div className="grid grid-cols-4 px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm font-semibold">
            <span className="text-gray-700">Total</span>
            <span className="text-right font-mono text-gray-700">{formatMinutes(totalMinutes)}</span>
            <span className="text-right font-mono text-gray-400">{formatMinutes(targetMinutes)}</span>
            <span className="text-right font-mono"><DeltaCell minutes={deltaMinutes} /></span>
          </div>
        )}
      </div>

      {/* Balkendiagramm */}
      {!loading && weeks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeks} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}h`} />
              <Tooltip
                formatter={(value, name) => [fmtHours(value * 60), name]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11 }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sollH" name="Soll" fill="#e5e7eb" radius={[2, 2, 0, 0]} />
              <Bar dataKey="istH"  name="Ist"  fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
