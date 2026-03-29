import { useState, useEffect, useRef } from 'react'
import { resolveConfig } from '../utils/config.js'
import { getConfig, saveConfig, getTasks, saveTask } from '../db/documents.js'
import { fetchAndImport, importFromJson } from '../db/import.js'

const WEEKDAYS = [
  { key: 'monday',    label: 'Mo' },
  { key: 'tuesday',   label: 'Di' },
  { key: 'wednesday', label: 'Mi' },
  { key: 'thursday',  label: 'Do' },
  { key: 'friday',    label: 'Fr' },
  { key: 'saturday',  label: 'Sa' },
  { key: 'sunday',    label: 'So' },
]

function SectionCard({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-4 space-y-4">
      <h2 className="font-medium text-gray-800">{title}</h2>
      {children}
    </section>
  )
}

function SaveButton({ onClick, saving, saved }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={saving}
        className="py-1.5 px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
      {saved && <span className="text-green-600 text-sm">✓ Gespeichert</span>}
    </div>
  )
}

// ── Soll-Zeit ─────────────────────────────────────────────────────────────────

function WorkScheduleSection({ config, onSaved }) {
  const targets = config.workSchedule.weekdayTargets
  const [times, setTimes] = useState({
    monday:    targets.monday    ?? '08:15',
    tuesday:   targets.tuesday   ?? '08:15',
    wednesday: targets.wednesday ?? '08:15',
    thursday:  targets.thursday  ?? '08:15',
    friday:    targets.friday    ?? '08:15',
    saturday:  targets.saturday  ?? '00:00',
    sunday:    targets.sunday    ?? '00:00',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await saveConfig({
      workSchedule: { ...config.workSchedule, weekdayTargets: times },
    })
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionCard title="Soll-Zeit">
      <div className="space-y-2">
        {WEEKDAYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-6 text-sm font-medium text-gray-600">{label}</span>
            <input
              type="time"
              value={times[key]}
              onChange={e => setTimes(t => ({ ...t, [key]: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-28"
            />
            {(key === 'saturday' || key === 'sunday') && times[key] === '00:00' && (
              <span className="text-xs text-gray-400">frei</span>
            )}
          </div>
        ))}
      </div>
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </SectionCard>
  )
}

// ── Auto-Ausstempeln ──────────────────────────────────────────────────────────

function AutoPunchOutSection({ config, onSaved }) {
  const [enabled, setEnabled] = useState(config.autoPunchOut.enabled)
  const [time, setTime] = useState(config.autoPunchOut.time)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await saveConfig({ autoPunchOut: { enabled, time } })
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionCard title="Auto-Ausstempeln">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        Aktiviert
      </label>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Uhrzeit</span>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          disabled={!enabled}
          className="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-28 disabled:opacity-40"
        />
      </div>
      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </SectionCard>
  )
}

// ── Auto-Pausen ───────────────────────────────────────────────────────────────

function AutoBreaksSection({ config, onSaved }) {
  const ab = config.autoBreaks
  const [enabled, setEnabled] = useState(ab.enabled)
  const [evalOrder, setEvalOrder] = useState(ab.evalOrder)
  const [validateActual, setValidateActual] = useState(ab.validateActual)
  const [rules, setRules] = useState(ab.rules.map(r => ({ ...r })))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateRule(i, field, value) {
    setRules(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await saveConfig({ autoBreaks: { enabled, evalOrder, validateActual, rules } })
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SectionCard title="Auto-Pausen">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4" />
        Aktiviert
      </label>

      <div className={`space-y-3 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">Auswertung</span>
          <select
            value={evalOrder}
            onChange={e => setEvalOrder(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="highestThreshold">Höchste Schwelle</option>
            <option value="firstMatch">Erste Übereinstimmung</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={validateActual}
            onChange={e => setValidateActual(e.target.checked)}
            className="w-4 h-4"
          />
          Tatsächliche Pausen anrechnen
        </label>

        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Regeln</p>
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={e => updateRule(i, 'enabled', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-gray-500 text-xs">ab</span>
              <input
                type="time"
                value={rule.afterWorkTime}
                onChange={e => updateRule(i, 'afterWorkTime', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs font-mono w-24"
              />
              <span className="text-gray-500 text-xs">→</span>
              <input
                type="time"
                value={rule.breakDuration}
                onChange={e => updateRule(i, 'breakDuration', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs font-mono w-24"
              />
              <span className="text-gray-400 text-xs">Pause</span>
            </div>
          ))}
        </div>
      </div>

      <SaveButton onClick={handleSave} saving={saving} saved={saved} />
    </SectionCard>
  )
}

// ── Pausenvorlagen ────────────────────────────────────────────────────────────

function PauseTemplatesSection({ config, onSaved }) {
  const [breaks, setBreaks] = useState(config.standardBreaks ?? [])
  const [newStart, setNewStart] = useState('12:00')
  const [newEnd, setNewEnd] = useState('12:30')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(updated) {
    setSaving(true)
    setSaved(false)
    await saveConfig({ standardBreaks: updated })
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  function remove(i) {
    const updated = breaks.filter((_, idx) => idx !== i)
    setBreaks(updated)
    handleSave(updated)
  }

  function add() {
    if (!newStart || !newEnd || newStart >= newEnd) return
    const updated = [...breaks, { start: newStart, end: newEnd }]
    setBreaks(updated)
    handleSave(updated)
  }

  return (
    <SectionCard title="Pausenvorlagen">
      <div className="space-y-2">
        {breaks.length === 0 && <p className="text-sm text-gray-400">Keine Vorlagen</p>}
        {breaks.map((brk, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-gray-700">{brk.start} – {brk.end}</span>
            <button
              onClick={() => remove(i)}
              className="ml-auto text-gray-400 hover:text-red-500 text-xs px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-500">Von</span>
        <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-24" />
        <span className="text-xs text-gray-500">Bis</span>
        <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm font-mono w-24" />
        <button onClick={add} disabled={!newStart || !newEnd || newStart >= newEnd}
          className="py-1 px-3 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50">
          +
        </button>
      </div>
      {saved && <p className="text-green-600 text-sm">✓ Gespeichert</p>}
    </SectionCard>
  )
}

// ── Aufgaben ──────────────────────────────────────────────────────────────────

function TasksSection() {
  const [tasks, setTasks] = useState([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(null) // taskId or 'new'
  const newInputRef = useRef()

  useEffect(() => {
    getTasks().then(setTasks)
  }, [])

  async function toggleActive(task) {
    setSaving(task.id)
    const updated = { ...task, inactive: !task.inactive }
    await saveTask(updated)
    setTasks(ts => ts.map(t => t.id === task.id ? updated : t))
    setSaving(null)
  }

  async function addTask() {
    const name = newName.trim()
    if (!name) return
    setSaving('new')
    const maxId = tasks.reduce((m, t) => Math.max(m, t.id), 0)
    const maxSort = tasks.reduce((m, t) => Math.max(m, t.sortNr), 0)
    const task = { id: maxId + 1, name, sortNr: maxSort + 10, inactive: false, colorCode: '', timeAccumulation: '100.0' }
    await saveTask(task)
    setTasks(ts => [...ts, task])
    setNewName('')
    setSaving(null)
    newInputRef.current?.focus()
  }

  return (
    <SectionCard title="Aufgaben">
      <div className="space-y-1">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={!task.inactive}
              onChange={() => toggleActive(task)}
              disabled={saving === task.id}
              className="w-4 h-4"
            />
            <span className={`text-sm flex-1 ${task.inactive ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {task.name}
            </span>
            {saving === task.id && <span className="text-xs text-gray-400">…</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <input
          ref={newInputRef}
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Neue Aufgabe…"
          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
        <button
          onClick={addTask}
          disabled={!newName.trim() || saving === 'new'}
          className="py-1.5 px-3 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          +
        </button>
      </div>
    </SectionCard>
  )
}

// ── Import ────────────────────────────────────────────────────────────────────

function ImportSection() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const configRef = useRef()
  const tasksRef = useRef()
  const stampsRef = useRef()

  async function handleFetch() {
    setLoading(true)
    setStatus(null)
    try {
      const result = await fetchAndImport()
      setStatus({ ok: true, ...result })
    } catch (e) {
      setStatus({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload() {
    const files = [configRef.current?.files[0], tasksRef.current?.files[0], stampsRef.current?.files[0]]
    if (files.some(f => !f)) {
      setStatus({ error: 'Bitte alle drei Dateien auswählen.' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const [config, tasks, stamps] = await Promise.all(files.map(f => f.text().then(JSON.parse)))
      const result = await importFromJson({ config, tasks, stamps })
      setStatus({ ok: true, ...result })
    } catch (e) {
      setStatus({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Daten importieren">
      <p className="text-sm text-gray-500">
        Einmaliger Import aus <code>data/</code>. Bereits vorhandene Einträge werden übersprungen.
      </p>
      <button
        onClick={handleFetch}
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
      >
        {loading ? 'Importiere…' : 'Import vom Server (/data/*.json)'}
      </button>
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-gray-400">Oder Dateien manuell hochladen:</p>
        {[['config.json', configRef], ['tasks.json', tasksRef], ['stamps.json', stampsRef]].map(([name, ref]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-500 text-xs">{name}</span>
            <input ref={ref} type="file" accept=".json" className="text-xs" />
          </label>
        ))}
        <button
          onClick={handleFileUpload}
          disabled={loading}
          className="py-1.5 px-4 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          Dateien importieren
        </button>
      </div>
      {status?.ok && (
        <p className="text-green-700 text-sm">✓ {status.imported} importiert, {status.skipped} übersprungen (Total: {status.total})</p>
      )}
      {status?.error && <p className="text-red-600 text-sm">Fehler: {status.error}</p>}
    </SectionCard>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [config, setConfig] = useState(null)

  async function loadConfig() {
    const stored = await getConfig()
    setConfig(resolveConfig(stored))
  }

  useEffect(() => { loadConfig() }, [])

  if (!config) {
    return <div className="text-gray-400 text-center mt-20 text-sm">Lade…</div>
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Einstellungen</h1>
      <WorkScheduleSection config={config} onSaved={loadConfig} />
      <AutoPunchOutSection config={config} onSaved={loadConfig} />
      <AutoBreaksSection      config={config} onSaved={loadConfig} />
      <PauseTemplatesSection  config={config} onSaved={loadConfig} />
      <TasksSection />
      <ImportSection />
    </div>
  )
}
