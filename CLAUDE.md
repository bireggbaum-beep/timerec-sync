# CLAUDE.md — TimeRec

## Was ist das hier?

Monorepo für den Neuaufbau der TimeRec Android-App (dynamicg) als Web-App (PWA).
Motivation: bessere Desktop-Unterstützung und verlässliche Geräte-Sync.

Repo: `bireggbaum-beep/timerec-sync`

## Repo-Struktur

```
timerec-sync/
├── backup/                    # timerec.db.gz (Android-App-Backup)
├── data/                      # generierte JSON-Dateien (via sync.py)
│   ├── config.json            # App-Einstellungen aus DB
│   ├── tasks.json             # Aufgaben/Kategorien
│   ├── stamps.json            # Rohe Stempeleinträge
│   ├── days.json              # Tage mit events (kommt/geht-Paare)
│   └── meta.json             # Sync-Metadaten
├── sync.py                    # Parst timerec.db.gz → JSON-Dateien
├── apps-script.js             # Google Apps Script: Drive → GitHub-Backup
├── REQUIREMENTS.md            # Vollständige Anforderungen + Tech Stack
├── app/                       # React+Vite Web-App
│   └── src/
│       ├── db/                # PouchDB-Layer (index, sync, documents)
│       ├── utils/             # time.js (timeToMin, formatMinutes, isoWeek…)
│       ├── components/        # Layout, NavBar, SyncIndicator
│       └── pages/             # Today ✅, Week 🔲, Month 🔲, History 🔲, Reports 🔲, Settings 🔲
├── docker-compose.yml         # CouchDB + Nginx
├── nginx/nginx.conf           # /db/ → CouchDB proxy, SPA fallback
├── couchdb/local.ini          # single-node config
├── deploy.sh                  # ./deploy.sh → npm build + docker compose up
└── .env.example               # COUCHDB_USER, COUCHDB_PASSWORD
```

## Stack

| Schicht | Technologie |
|---------|-------------|
| App | React + Vite (Static Build, PWA) |
| Lokaler Speicher + Sync | PouchDB (IndexedDB) |
| Sync-Server + DB | CouchDB (Docker) |
| Web-Server | Nginx (Docker) |
| Deployment | `docker-compose up` auf Raspberry Pi |
| Charts | Recharts |
| Export | jsPDF + SheetJS |

Alles läuft auf einem Raspberry Pi via `docker-compose`. Kein externer Service, kein Account.

## Architektur

```
Browser (PWA)                  Raspberry Pi
──────────────                 ──────────────────────────
PouchDB (IndexedDB)  ◄─sync──► CouchDB :5984
  primäre Datenquelle           via nginx-Proxy /db/
  offline-fähig                Nginx :80 → App-Files
```

- Lesen/Schreiben immer lokal → sofort, kein Lag
- Online: Live-Sync zu CouchDB, andere Geräte via PouchDB-Replikation aktuell
- Offline: funktioniert vollständig, sync beim nächsten Online-Moment

## Datenmodell (PouchDB Dokumente)

```js
// _id: 'config'
{ type: 'config', workSchedule: {...}, autoPunchOut: {...}, autoBreaks: {...}, ... }

// _id: 'task::1'
{ type: 'task', id: 1, name: 'Projektarbeit', sortNr: 10, inactive: false, colorCode: '', ... }

// _id: 'day::2024-01-15'
{ type: 'day', date: '2024-01-15', note: '', missingCheckout: false }

// _id: 'stamp::2024-01-15::001'
{ type: 'stamp', date: '2024-01-15', time: '08:00', action: 'in', taskId: 1, taskName: 'Projektarbeit', comment: '' }
```

## Implementierungsstand

| Seite | Status |
|-------|--------|
| Today (Kommt/Geht, Aufgaben, Stempelliste, laufende Uhr) | ✅ |
| Week (Ist, Soll, Delta pro Tag + Wochentotal) | 🔲 |
| Month (Ist, Soll, Delta pro Woche + Chart) | 🔲 |
| History (Tagesverlauf, Notizen, Abwesenheits-Templates) | 🔲 |
| Reports (PDF, Excel, HTML Export) | 🔲 |
| Settings (Soll-Zeit, Auto-Pausen, Aufgaben) | 🔲 |

## Scope

✅ Kern: Einstempeln / Ausstempeln
✅ Aufgaben / Tasks
✅ Auto-Pausen (regelbasiert)
✅ Auto-Ausstempeln (konfigurierbare Uhrzeit)
✅ Über-/Unterzeit (Delta Ist vs. Soll)
✅ Wochen- & Monatsübersicht
✅ Balance Tracker / Flexzeit-Saldo
✅ Notizen pro Tag
✅ Abwesenheits-Templates (Urlaub, Feiertag, Kompensation)
✅ Reports / Export (PDF, Excel, HTML)
✅ Dezimalzeit-Format
🔲 NFC (Hook vorgesehen, nicht implementiert)
🔲 Widget / Notifications (Hook vorgesehen, nicht implementiert)
❌ Geofencing, Wear OS, Tasker, Calendar Sync, Mehrsprachigkeit (ausgeschlossen)

## Development

```bash
cd app
npm install
npm run dev       # lokaler Dev-Server auf :5173
```

CouchDB für lokale Entwicklung:
```bash
docker compose up couchdb
```

## Deployment (Raspberry Pi)

```bash
cp .env.example .env
# COUCHDB_PASSWORD in .env setzen
./deploy.sh
```

## Branch-Konvention

Entwicklung auf Feature-Branches, merge nach `main`.
Aktueller Branch: `claude/refactor-event-json-structure-8mnsk`
