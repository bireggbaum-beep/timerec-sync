import { useState, useEffect } from 'react'
import { weekDates, calculateWeek } from '../utils/week.js'
import { formatMinutes } from '../utils/time.js'
import { resolveConfig } from '../utils/config.js'
import { getStampsForDay, getConfig } from '../db/documents.js'

const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function DeltaCell({ minutes }) {
  if (minutes === null) return <span className="text-gray-300">—</span>
  const cls = minutes >= 0 ? 'text-green-600' : 'text-red-500'
  const sign = minutes >= 0 ? '+' : ''
  return <span className={cls}>{sign}{formatMinutes(minutes)}</span>
}

export default function Week() {
  const [currentDate, setCurrentDate] = useState(todayStr)
  const [week, setWeek] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const dates = weekDates(currentDate)
      const [stampsArrays, storedConfig] = await Promise.all([
        Promise.all(dates.map(d => getStampsForDay(d))),
        getConfig(),
      ])
      if (cancelled) return
      const stampsMap = {}
      dates.forEach((d, i) => { stampsMap[d] = stampsArrays[i] })
      const config = resolveConfig(storedConfig)
      setWeek(calculateWeek(currentDate, stampsMap, config))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [currentDate])

  const isCurrentWeek = weekDates(currentDate)[0] === weekDates(todayStr())[0]

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate(d => addDays(d, -7))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg"
        >
          ←
        </button>
        <div className="text-center">
          <span className="font-medium text-gray-800">
            {week ? `KW ${week.weekNumber} · ${week.year}` : '…'}
          </span>
          {!isCurrentWeek && (
            <button
              onClick={() => setCurrentDate(todayStr())}
              className="ml-3 text-xs text-blue-600 hover:underline"
            >
              heute
            </button>
          )}
        </div>
        <button
          onClick={() => setCurrentDate(d => addDays(d, 7))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 text-lg"
        >
          →
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-4 gap-0 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
          <span>Tag</span>
          <span className="text-right">Ist</span>
          <span className="text-right">Soll</span>
          <span className="text-right">Delta</span>
        </div>

        {loading && (
          <div className="text-center text-gray-400 py-8 text-sm">Lade…</div>
        )}

        {!loading && week && week.days.map((day, i) => {
          const isWeekend = day.targetMinutes === 0
          const isToday = day.date === todayStr()
          return (
            <div
              key={day.date}
              className={[
                'grid grid-cols-4 gap-0 px-4 py-3 border-b border-gray-50 text-sm',
                isWeekend ? 'opacity-40' : '',
                isToday ? 'bg-blue-50' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium text-gray-700 w-6">{DAYS_DE[i]}</span>
                <span className="text-gray-500 text-xs">{fmtDate(day.date)}</span>
              </span>
              <span className="text-right font-mono text-gray-700">
                {isWeekend ? <span className="text-gray-300">—</span> : formatMinutes(day.totalMinutes)}
              </span>
              <span className="text-right font-mono text-gray-500">
                {isWeekend ? <span className="text-gray-300">—</span> : formatMinutes(day.targetMinutes)}
              </span>
              <span className="text-right font-mono">
                <DeltaCell minutes={isWeekend ? null : day.deltaMinutes} />
              </span>
            </div>
          )
        })}

        {/* Total row */}
        {!loading && week && (
          <div className="grid grid-cols-4 gap-0 px-4 py-3 bg-gray-50 text-sm font-semibold border-t border-gray-200">
            <span className="text-gray-700">Total</span>
            <span className="text-right font-mono text-gray-700">{formatMinutes(week.totalMinutes)}</span>
            <span className="text-right font-mono text-gray-500">{formatMinutes(week.targetMinutes)}</span>
            <span className="text-right font-mono">
              <DeltaCell minutes={week.deltaMinutes} />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
