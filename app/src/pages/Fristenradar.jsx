import { useState, useEffect, useCallback } from 'react'
import { getStampsForDay, getConfig, isCurrentlyIn, getTasks } from '../db/documents'
import { formatMinutes, toDateStr, isoWeek } from '../utils/time'
import { resolveConfig, targetMinutesForDate } from '../utils/config'
import { calculateDay } from '../utils/workday'
import { calculateWeek, weekDates } from '../utils/week'

/* ── helpers ── */

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Gute Nacht.'
  if (h < 11) return 'Guten Morgen.'
  if (h < 14) return 'Guten Mittag.'
  if (h < 18) return 'Guten Tag.'
  if (h < 22) return 'Guten Abend.'
  return 'Gute Nacht.'
}

function formatDateLong(d) {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
}

function pct(a, b) {
  if (!b) return 0
  return Math.min(100, Math.round((a / b) * 100))
}

/** Predict end time: now + remaining minutes → "HH:MM" */
function predictEnd(totalMinutes, targetMinutes) {
  const remaining = targetMinutes - totalMinutes
  if (remaining <= 0) return null
  const now = new Date()
  const end = new Date(now.getTime() + remaining * 60000)
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}

/** Month date range: first … last day */
function monthDates(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const dates = []
  for (let day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    dates.push(toDateStr(new Date(day)))
  }
  return dates
}

/* ── Ring SVG ── */
const RING_R = 100
const RING_C = 2 * Math.PI * RING_R // 628.32

function ProgressRing({ percent, active }) {
  const offset = RING_C - (RING_C * Math.min(percent, 100)) / 100
  return (
    <svg
      viewBox="0 0 240 240"
      className="w-full h-full"
      style={{
        transform: 'rotate(-90deg)',
        filter: active
          ? 'drop-shadow(0 0 18px rgba(96,165,250,0.35))'
          : 'drop-shadow(0 0 12px rgba(96,165,250,0.20))',
      }}
    >
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r={RING_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="120" cy="120" r={RING_R}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

/* ── ProgressBar ── */
function ProgressBar({ value, max, label, warn }) {
  const p = pct(value, max)
  const delta = value - max
  const cls = warn
    ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
    : 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(96,165,250,0.35)]'
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[13px] font-medium text-white/50 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-medium text-white/90 tabular-nums">
          {formatMinutes(value)} <span className="text-white/50 font-normal">/ {formatMinutes(max)}</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${cls}`} style={{ width: `${p}%` }} />
      </div>
      {delta !== null && max > 0 && (
        <div className={`flex justify-end mt-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}{formatMinutes(delta)} {delta >= 0 ? 'Überzeit' : 'offen'}
        </div>
      )}
    </div>
  )
}

/* ── FristItem ── */
function FristItem({ color, label, detail, countdown }) {
  const dotCls = {
    green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    blue: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]',
    amber: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]',
    red: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]',
  }[color] || 'bg-blue-400'

  const countCls = {
    green: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  }[color] || 'text-blue-400'

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 bg-white/[0.05] border border-white/[0.07] rounded-2xl mb-2 hover:bg-white/[0.08] transition-colors">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotCls}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white/90">{label}</div>
        <div className="text-xs text-white/50 mt-0.5">{detail}</div>
      </div>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${countCls}`}>{countdown}</span>
    </div>
  )
}

/* ── Main Component ── */

export default function Fristenradar() {
  const [clock, setClock] = useState(nowHHMM())
  const [loading, setLoading] = useState(true)
  const [inStamp, setInStamp] = useState(null)
  const [taskName, setTaskName] = useState(null)

  // Day data
  const [dayResult, setDayResult] = useState(null)
  const [liveMinutes, setLiveMinutes] = useState(0)

  // Week/Month data
  const [weekData, setWeekData] = useState(null)
  const [monthTotal, setMonthTotal] = useState(0)
  const [monthTarget, setMonthTarget] = useState(0)

  const today = toDateStr(new Date())

  const load = useCallback(async () => {
    const [stamps, storedConfig, currentIn] = await Promise.all([
      getStampsForDay(today),
      getConfig(),
      isCurrentlyIn(),
    ])
    const config = resolveConfig(storedConfig)
    const target = targetMinutesForDate(today, config)
    const autoBreaks = config.autoBreaks
    const result = calculateDay(stamps, target, autoBreaks)
    setDayResult(result)
    setInStamp(currentIn)
    setTaskName(currentIn?.taskName ?? null)

    // Live minutes (add running session)
    if (result.openSession) {
      const lastIn = stamps.filter(s => s.action === 'in').pop()
      if (lastIn) {
        const [h, m] = lastIn.time.split(':').map(Number)
        const now = new Date()
        const elapsed = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
        setLiveMinutes(result.totalMinutes + Math.max(0, elapsed))
      }
    } else {
      setLiveMinutes(result.totalMinutes)
    }

    // Week
    const wDates = weekDates(today)
    const wStampsArrays = await Promise.all(wDates.map(d => getStampsForDay(d)))
    const wStampsMap = {}
    wDates.forEach((d, i) => { wStampsMap[d] = wStampsArrays[i] })
    setWeekData(calculateWeek(today, wStampsMap, config))

    // Month (sum up days that have stamps)
    const mDates = monthDates(today)
    let mTotal = 0, mTarget = 0
    for (const d of mDates) {
      const t = targetMinutesForDate(d, config)
      if (d > today) break // don't count future
      const st = d === today ? stamps : await getStampsForDay(d)
      if (st.length || d === today) {
        const r = d === today ? result : calculateDay(st, t, autoBreaks)
        mTotal += d === today ? liveMinutes || result.totalMinutes : r.totalMinutes
        mTarget += t
      }
    }
    setMonthTotal(mTotal)
    setMonthTarget(mTarget)

    setLoading(false)
  }, [today])

  // Initial load + periodic refresh
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(nowHHMM()), 10000)
    return () => clearInterval(id)
  }, [])

  // Live timer
  useEffect(() => {
    if (!dayResult?.openSession || !inStamp) return
    const tick = () => {
      const [h, m] = inStamp.time.split(':').map(Number)
      const now = new Date()
      const elapsed = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
      setLiveMinutes(dayResult.totalMinutes + Math.max(0, elapsed))
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [dayResult, inStamp])

  const target = dayResult?.targetMinutes ?? 0
  const percent = pct(liveMinutes, target)
  const endTime = dayResult?.openSession ? predictEnd(liveMinutes, target) : null
  const remaining = target - liveMinutes
  const isIn = !!inStamp

  const weekNum = weekData ? weekData.weekNumber : isoWeek(new Date())
  const weekTotal = weekData?.totalMinutes ?? 0
  const weekTarget = weekData?.targetMinutes ?? 0
  const weekRemaining = weekTarget - weekTotal
  const daysLeftInWeek = weekData ? weekData.days.filter(d => d.date > today && d.targetMinutes > 0).length : 0

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = daysInMonth - now.getDate()
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

  // Balance
  const balanceMinutes = weekData ? weekData.deltaMinutes : 0
  const isPositive = balanceMinutes >= 0

  // Fristen items
  const fristen = []
  if (isIn && endTime && remaining > 0) {
    fristen.push({
      color: 'green',
      label: 'Feierabend',
      detail: `Tagessoll erreicht um ~${endTime}`,
      countdown: formatMinutes(remaining),
    })
  } else if (!isIn && target > 0 && liveMinutes >= target) {
    fristen.push({
      color: 'green',
      label: 'Tagessoll erreicht',
      detail: `${formatMinutes(liveMinutes)} von ${formatMinutes(target)}`,
      countdown: '✓',
    })
  }
  if (weekRemaining > 0) {
    fristen.push({
      color: 'blue',
      label: 'Wochenziel',
      detail: `${formatMinutes(weekTarget)} Soll · noch ${formatMinutes(weekRemaining)} offen`,
      countdown: `${daysLeftInWeek} Tag${daysLeftInWeek !== 1 ? 'e' : ''}`,
    })
  } else if (weekData) {
    fristen.push({
      color: 'green',
      label: 'Wochenziel erreicht',
      detail: `${formatMinutes(weekTotal)} von ${formatMinutes(weekTarget)}`,
      countdown: '✓',
    })
  }
  fristen.push({
    color: daysLeftInMonth <= 5 ? 'amber' : 'blue',
    label: 'Monatsabschluss',
    detail: `Letzter Tag: ${daysInMonth}. ${monthNames[now.getMonth()]}`,
    countdown: `${daysLeftInMonth} Tage`,
  })

  // Flextime limit
  const FLEX_LIMIT = 20 * 60 // 20h in minutes
  const flexRemaining = FLEX_LIMIT - Math.abs(balanceMinutes)
  fristen.push({
    color: flexRemaining < 5 * 60 ? 'red' : 'green',
    label: 'Flexzeit-Grenze',
    detail: `Max. ±${formatMinutes(FLEX_LIMIT)} · Aktuell ${isPositive ? '+' : ''}${formatMinutes(balanceMinutes)}`,
    countdown: formatMinutes(flexRemaining),
  })

  // Balance message
  let balanceMsg = ''
  if (isPositive && balanceMinutes > 60) balanceMsg = 'Du bist gut auf Kurs.'
  else if (isPositive) balanceMsg = 'Alles im grünen Bereich.'
  else if (balanceMinutes > -60) balanceMsg = 'Nur knapp dahinter.'
  else balanceMsg = 'Etwas aufzuholen — du packst das.'

  return (
    <div
      className="min-h-full -m-4 p-6 pb-8"
      style={{
        background: 'linear-gradient(180deg, #060a1a 0%, #0d1333 100%)',
      }}
    >
      {/* Ambient glow overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(59,130,246,0.07) 0%, transparent 60%)',
            'radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)',
            'radial-gradient(ellipse 50% 40% at 20% 70%, rgba(34,211,238,0.04) 0%, transparent 50%)',
          ].join(', '),
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-md mx-auto">

        {/* ━━ Greeting ━━ */}
        <div className="mb-8">
          <div className="float-right text-[40px] font-extralight text-white/80 tabular-nums tracking-tight leading-none">
            {clock}
          </div>
          <div className="text-[26px] font-light text-white/90 tracking-tight leading-tight">
            {timeGreeting()}
          </div>
          <div className="text-sm text-white/45 mt-1.5 font-normal">
            {formatDateLong(new Date())}
          </div>
        </div>

        {/* ━━ Status Pills ━━ */}
        <div className="flex justify-center gap-2.5 mb-7">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-xs font-medium text-white/50">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isIn ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-red-400'}`}
              style={isIn ? { animation: 'pulse 2.5s ease-in-out infinite' } : {}}
            />
            {isIn ? 'Eingestempelt' : 'Ausgestempelt'}
          </div>
          {taskName && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-xs font-medium text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {taskName}
            </div>
          )}
        </div>

        {/* ━━ Ring ━━ */}
        {loading ? (
          <div className="w-60 h-60 mx-auto mb-8 flex items-center justify-center text-white/30 text-sm">
            Lade…
          </div>
        ) : (
          <div className="relative w-60 h-60 mx-auto mb-8">
            <ProgressRing percent={percent} active={isIn} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[11px] uppercase tracking-[1.5px] text-white/25 font-medium">Heute</div>
              <div className="text-[34px] font-semibold text-white/90 tabular-nums tracking-tight leading-none mt-1">
                {formatMinutes(liveMinutes)}
              </div>
              <div className="text-sm text-white/45 mt-1">von {formatMinutes(target)}</div>
              <div className="text-[13px] font-semibold text-blue-400/80 mt-2">{percent}%</div>
            </div>
          </div>
        )}

        {/* ━━ Feierabend Prediction ━━ */}
        {isIn && endTime && remaining > 0 && (
          <div className="text-center mb-8 px-4 py-4 bg-white/[0.05] border border-white/[0.07] rounded-2xl">
            <div className="text-[11px] uppercase tracking-[1.5px] text-white/25 font-medium mb-1.5">
              Voraussichtlich Feierabend
            </div>
            <div className="text-[30px] font-light text-cyan-400 tabular-nums tracking-tight">
              {endTime}
            </div>
            <div className="text-xs text-white/45 mt-1">
              noch {formatMinutes(remaining)} — du schaffst das
            </div>
          </div>
        )}

        {/* ━━ Balance Card ━━ */}
        {!loading && (
          <div
            className={`relative overflow-hidden text-center px-6 py-5 mb-7 rounded-[20px] border
              ${isPositive
                ? 'bg-white/[0.05] border-emerald-400/15 shadow-[0_0_30px_-10px_rgba(52,211,153,0.25)]'
                : 'bg-white/[0.05] border-red-400/15 shadow-[0_0_30px_-10px_rgba(248,113,113,0.2)]'
              }`}
          >
            <div
              className="absolute inset-0 rounded-[20px] opacity-[0.04]"
              style={{
                background: isPositive
                  ? 'radial-gradient(ellipse at center, #34d399, transparent 70%)'
                  : 'radial-gradient(ellipse at center, #f87171, transparent 70%)',
              }}
            />
            <div className={`relative text-[26px] font-semibold tracking-tight flex items-center justify-center gap-2
              ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className="text-xl opacity-70">{isPositive ? '↗' : '↘'}</span>
              {isPositive ? '+' : ''}{formatMinutes(balanceMinutes)}
            </div>
            <div className="relative text-[13px] text-white/45 mt-1.5">Flexzeit-Saldo</div>
            <div className="relative text-sm text-white/45 mt-2.5 italic opacity-80">{balanceMsg}</div>
          </div>
        )}

        {/* ━━ Divider ━━ */}
        <div className="h-px my-7" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />

        {/* ━━ Week Progress ━━ */}
        {weekData && (
          <ProgressBar
            value={weekTotal}
            max={weekTarget}
            label={`Woche · KW ${weekNum}`}
          />
        )}

        {/* ━━ Month Progress ━━ */}
        {!loading && (
          <ProgressBar
            value={monthTotal}
            max={monthTarget}
            label={`${monthNames[now.getMonth()]} ${now.getFullYear()}`}
          />
        )}

        {/* ━━ Divider ━━ */}
        <div className="h-px my-7" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />

        {/* ━━ Fristen ━━ */}
        <div className="mt-1">
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/50 uppercase tracking-wider mb-3.5">
            <span className="w-1 h-3.5 bg-blue-400/60 rounded-sm" />
            Fristen
          </div>
          {fristen.map((f, i) => (
            <FristItem key={i} {...f} />
          ))}
        </div>
      </div>

      {/* Pulse keyframe (for breathing dot) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
