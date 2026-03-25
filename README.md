# timerec-sync
Zeiterfassung
TimeRec Sync
Synchronisiert die Zeiterfassung Android App (DynamicG) automatisch als JSON-Dateien auf GitHub.
```
Handy: Zeiterfassung App
  ↓  Auto-Backup
Google Drive (timerec.db.gz)
  ↓  Google Apps Script (täglich 02:00)
GitHub Repo (backup/timerec.db.gz)
  ↓  GitHub Action (automatisch bei Push)
GitHub Repo (data/*.json) ← deine Daten
```
Keine externen Services, keine API-Tokens, keine Python-Dependencies.
---
Ergebnis: JSON-Dateien
Datei	Inhalt
`meta.json`	Sync-Zeitpunkt, Anzahlen, Datumsbereich
`tasks.json`	Alle Tasks mit ID, Name, Kunde
`stamps.json`	Alle Stempel (flach, chronologisch)
`days.json`	Nach Tag gruppiert mit Stempeln, Arbeitszeit, Notizen
Zugriff per URL:
```
https://raw.githubusercontent.com/DEIN-USER/timerec-sync/main/data/days.json
```
---
Setup (15 Minuten)
Schritt 1: GitHub Repo erstellen
Erstelle ein neues privates Repo auf GitHub (z.B. `timerec-sync`)
Pushe alle Dateien aus diesem Ordner dorthin:
```bash
   cd timerec-sync
   git init
   git add .
   git commit -m "initial"
   git remote add origin git@github.com:DEIN-USER/timerec-sync.git
   git push -u origin main
   ```
Gehe zu Settings → Actions → General → Workflow permissions
Wähle "Read and write permissions" → Save
Schritt 2: GitHub Token erstellen
Gehe zu github.com/settings/tokens?type=beta
Klicke "Generate new token"
Einstellungen:
Name: `timerec-sync`
Expiration: 1 year (oder Custom)
Repository access: Only select repositories → dein `timerec-sync` Repo
Permissions → Contents: Read and write
Generate token → Token kopieren (beginnt mit `github_pat_...`)
Schritt 3: Google Apps Script einrichten
Gehe zu script.google.com → Neues Projekt
Lösche den Inhalt und füge den Inhalt von `apps-script.js` ein
Setze die 3 Konstanten oben im Script:
```javascript
   const GITHUB_TOKEN = "github_pat_XXXXXXXXXX";  // aus Schritt 2
   const GITHUB_REPO  = "DEIN-USER/timerec-sync";  // dein Repo
   const BACKUP_FILENAME = "timerec-free.db.gz";    // oder timerec-pro.db.gz
   ```
Speichern (Ctrl+S)
Schritt 4: Testen
Wähle im Dropdown oben `testDriveAccess` → Klicke ▶ Ausführen
Beim ersten Mal: Google fragt nach Berechtigungen → erlauben
Im Log (Ausführungsprotokoll) sollte stehen: `Datei gefunden: timerec-free.db.gz`
Falls nicht: mach zuerst ein Backup in der Zeiterfassung App auf Google Drive
Wähle `syncToGitHub` → Klicke ▶ Ausführen
Im Log sollte stehen: `Erfolgreich nach GitHub gepusht!`
Gehe zu deinem GitHub Repo → der Ordner `backup/` sollte jetzt `timerec.db.gz` enthalten
Unter Actions sollte der Workflow "TimeRec Parse" automatisch gestartet sein
Nach ca. 30 Sekunden: `data/` enthält deine JSON-Dateien
Schritt 5: Automatisierung aktivieren
Zurück im Apps Script: wähle `setup` → Klicke ▶ Ausführen
Das Script läuft jetzt automatisch jede Nacht um ca. 02:00 Uhr
Fertig!
---
Hinweise
Auto-Backup aktivieren: In der Zeiterfassung App unter Einstellungen → Backup → Auto-Backup auf Google Drive einschalten, damit die `.db.gz` immer aktuell ist
Kein Spam: GitHub Action committed nur, wenn sich die Daten geändert haben
Manuell auslösen: Im Apps Script jederzeit `syncToGitHub` manuell starten, oder im GitHub Repo unter Actions → "Run workflow"
Keine Python-Dependencies: `sync.py` braucht nur Python stdlib (sqlite3, gzip, json)
Dateien
```
├── .github/workflows/parse.yml  # GitHub Action: parse → JSON
├── apps-script.js               # Google Apps Script (zum Kopieren)
├── sync.py                      # SQLite Parser (Python stdlib only)
├── backup/                      # ← db.gz landet hier (via Apps Script)
│   └── timerec.db.gz
├── data/                        # ← generierte JSON-Dateien
│   ├── meta.json
│   ├── tasks.json
│   ├── stamps.json
│   └── days.json
└── README.md
```
