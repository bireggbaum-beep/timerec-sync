import { useEffect, useState, useCallback } from 'react'
import { punch, isCurrentlyIn, getStampsForDay, getTasks, updateStamp } from '../db/documents'
import { formatMinutes } from '../utils/time'

export default function Today() {
  const today = new Date().toISOString().slice(0, 10)
  const [activeStamp, setActiveStamp] = useState(null)
  const [stamps, setStamps] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    const [active, dayStamps, taskList] = await Promise.all([
      isCurrentlyIn(),
      getStampsForDay(today),
      getTasks(),
    ])
    setActiveStamp(active)
    setStamps(dayStamps)
    setTasks(taskList)
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

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Datum */}
      <div className="text-center text-gray-500 text-sm">
        {new Date(today).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {/* Stempel-Button */}
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
            isIn
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } disabled:opacity-50`}
        >
          {isIn ? 'GEHT' : 'KOMMT'}
        </button>
        {isIn && (
          <div className="text-sm text-gray-500">eingestempelt seit {activeStamp.time}</div>
        )}
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
    </div>
  )
}
