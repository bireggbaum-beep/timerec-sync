import { useEffect, useState, useCallback } from 'react'
import { punch, isCurrentlyIn, getStampsForDay, getTasks, updateStamp, applyBreak, getConfig } from '../db/documents'
import { formatMinutes } from '../utils/time'
import { resolveConfig } from '../utils/config'

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function addMins(hhmm, delta) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = ((h * 60 + m + delta) % 1440 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function VorlageModal({ isIn, standardBreaks, today, onApply, onClose }) {
  const relativeOptions = [
    { label: '+15 min', delta: 15, dir: 'forward' },
    { label: '+30 min', delta: 30, dir: 'forward' },
    { label: '−15 min', delta: -15, dir: 'backward' },
    { label: '−30 min', delta: -30, dir: 'backward' },
  ]

  async function applyFixed(brk) {
    await applyBreak(today, brk.start, brk.end)
    onApply()
  }

  async function applyRelative(delta) {
    const now = nowHHMM()
    const out = delta > 0 ? now : addMins(now, delta)
    const inn = delta > 0 ? addMins(now, delta) : now
    await applyBreak(today, out, inn)
    onApply()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-5 shadow-xl">
        <h2 className="font-semibold text-gray-800">Vorlage</h2>

        {/* Feste Pausen */}
        {standardBreaks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Feste Pausen</p>
            <div className="flex flex-wrap gap-2">
              {standardBreaks.map((brk, i) => (
                <button
                  key={i}
                  onClick={() => applyFixed(brk)}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-mono hover:bg-blue-100"
                >
                  {brk.start}–{brk.end}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pause jetzt */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Pause jetzt {!isIn && <span className="normal-case font-normal">(nur wenn eingestempelt)</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {relativeOptions.map(({ label, delta }) => (
              <button
                key={label}
                onClick={() => applyRelative(delta)}
                disabled={!isIn}
                className="px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

export default function Today() {
  const today = new Date().toISOString().slice(0, 10)
  const [activeStamp, setActiveStamp] = useState(null)
  const [stamps, setStamps] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showVorlage, setShowVorlage] = useState(false)
  const [config, setConfig] = useState(null)

  const reload = useCallback(async () => {
    const [active, dayStamps, taskList, storedConfig] = await Promise.all([
      isCurrentlyIn(),
      getStampsForDay(today),
      getTasks(),
      getConfig(),
    ])
    setActiveStamp(active)
    setStamps(dayStamps)
    setTasks(taskList)
    setConfig(resolveConfig(storedConfig))
    if (!selectedTaskId && taskList.length > 0) {
      setSelectedTaskId(taskList[0].id)
    }
  }, [today, selectedTaskId])

  useEffect(() => { reload() }, [reload])

  // Laufende Uhr
  useEffect(() => {
    if (!activeStamp) return
    const update = () => {
      const [h, m] = activeStamp.time.split(':').map(Number)
      const start = h * 60 + m
      const now = new Date()
      setElapsed(now.getHours() * 60 + now.getMinutes() - start)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [activeStamp])

  async function handlePunch() {
    setLoading(true)
    const task = tasks.find(t => t.id === selectedTaskId)
    await punch({ taskId: task?.id ?? 0, taskName: task?.name ?? '(Standard)' })
    await reload()
    setLoading(false)
  }

  const isIn = !!activeStamp
  const standardBreaks = config?.standardBreaks ?? []

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Datum */}
      <div className="text-center text-gray-500 text-sm">
        {new Date(today + 'T12:00:00').toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {/* Stempel-Button + Vorlage */}
      <div className="flex flex-col items-center gap-3">
        {isIn && (
          <div className="text-2xl font-mono font-semibold text-blue-800">
            {formatMinutes(elapsed)}
          </div>
        )}
        <button
          onClick={handlePunch}
          disabled={loading}
          className={`w-36 h-36 rounded-full text-white text-xl font-bold shadow-lg transition-colors ${
            isIn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          } disabled:opacity-50`}
        >
          {isIn ? 'GEHT' : 'KOMMT'}
        </button>
        {isIn && (
          <div className="text-sm text-gray-500">eingestempelt seit {activeStamp.time}</div>
        )}
        <button
          onClick={() => setShowVorlage(true)}
          className="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-1.5 hover:bg-blue-50"
        >
          Vorlage
        </button>
      </div>

      {/* Aufgaben-Auswahl */}
      {!isIn && tasks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aufgabe</label>
          <select
            value={selectedTaskId ?? ''}
            onChange={e => setSelectedTaskId(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {tasks.filter(t => !t.inactive).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Heutige Stempel */}
      {stamps.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">Heute</h2>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {stamps.map(s => (
              <div key={s._id} className="flex items-center px-4 py-2.5 gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.action === 'in' ? 'bg-green-400' : 'bg-red-400'}`} />
                <input
                  type="time"
                  defaultValue={s.time}
                  onBlur={async e => {
                    if (e.target.value && e.target.value !== s.time) {
                      await updateStamp({ ...s, time: e.target.value })
                      await reload()
                    }
                  }}
                  className="font-mono text-sm w-14 bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus:ring-0 text-gray-700"
                />
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  s.action === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {s.action === 'in' ? 'Kommt' : 'Geht'}
                </span>
                <span className="text-sm text-gray-500 truncate">{s.taskName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vorlage Modal */}
      {showVorlage && (
        <VorlageModal
          isIn={isIn}
          standardBreaks={standardBreaks}
          today={today}
          onApply={async () => { setShowVorlage(false); await reload() }}
          onClose={() => setShowVorlage(false)}
        />
      )}
    </div>
  )
}
