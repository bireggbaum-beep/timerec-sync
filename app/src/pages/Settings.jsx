import { useState, useRef } from 'react'
import { fetchAndImport, importFromJson } from '../db/import.js'

export default function Settings() {
  const [status, setStatus] = useState(null) // null | {ok, imported, skipped, total} | {error}
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
      setStatus({ error: 'Bitte alle drei Dateien auswählen (config.json, tasks.json, stamps.json).' })
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
    <div className="max-w-lg mx-auto p-4 space-y-8">
      <h1 className="text-xl font-semibold">Einstellungen</h1>

      <section className="space-y-4">
        <h2 className="font-medium text-gray-700">Daten importieren</h2>
        <p className="text-sm text-gray-500">
          Einmaliger Import aus den JSON-Dateien in <code>data/</code>. Bereits vorhandene Einträge werden übersprungen.
        </p>

        <button
          onClick={handleFetch}
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Importiere…' : 'Import vom Server (/data/*.json)'}
        </button>

        <div className="border-t pt-4 space-y-2">
          <p className="text-sm text-gray-500">Oder Dateien manuell hochladen:</p>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-28 text-gray-600">config.json</span>
            <input ref={configRef} type="file" accept=".json" className="text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-28 text-gray-600">tasks.json</span>
            <input ref={tasksRef} type="file" accept=".json" className="text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-28 text-gray-600">stamps.json</span>
            <input ref={stampsRef} type="file" accept=".json" className="text-sm" />
          </label>
          <button
            onClick={handleFileUpload}
            disabled={loading}
            className="mt-2 py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Dateien importieren
          </button>
        </div>

        {status?.ok && (
          <p className="text-green-700 text-sm">
            ✓ {status.imported} Einträge importiert, {status.skipped} übersprungen (Total: {status.total})
          </p>
        )}
        {status?.error && (
          <p className="text-red-600 text-sm">Fehler: {status.error}</p>
        )}
      </section>

      <section className="text-gray-400 text-sm">
        Weitere Einstellungen (Soll-Zeit, Auto-Pausen, Aufgaben) folgen.
      </section>
    </div>
  )
}
