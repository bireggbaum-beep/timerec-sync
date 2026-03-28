# Requirements — TimeRec Web App

## Motivation

Die bestehende Android-App (dynamicg TimeRec) hat keinen Desktop-Client und keine
verlässliche Geräte-Sync. Ziel ist eine Web-App die denselben Funktionsumfang bietet,
auf Desktop und Mobile gleichwertig läuft (PWA) und Daten zentral speichert.

---

## Nicht-funktionale Anforderungen

- **PWA** — installierbar auf Mobile (iOS/Android) und Desktop
- **Responsive** — vollwertige Nutzung auf kleinen und grossen Bildschirmen
- **Offline-fähig** — Basisoperationen (Einstempeln, Ausstempeln) auch ohne Verbindung
- **Sync** — Daten sofort auf allen Geräten aktuell (kein manuelles Backup nötig)
- **Einzel-Nutzer** — keine Team- oder Multi-User-Anforderungen
- **Deutsch** — einzige Sprache

---

## Funktionale Anforderungen

### F-01 Kern: Stempeluhr
- Einstempeln (Kommt) und Ausstempeln (Geht)
- Aktuell laufende Arbeitszeit sichtbar
- Offene Sitzung (Kommt ohne Geht) wird markiert/angezeigt
- Manuelle Korrektur von Stempelzeiten

### F-02 Aufgaben / Tasks
- Arbeitszeit einer Aufgabe zuordnen beim Stempeln
- Aufgaben verwalten (Name, Farbe, aktiv/inaktiv)
- Aufgabe kann von Soll-Zeit-Berechnung ausgenommen werden (`targetOff`)
- Aufgabe kann von Zeitauswertung ausgenommen werden (`timeSumOff`)

### F-03 Auto-Pausen
- Regelbasierter automatischer Pausenabzug
- Konfigurierbare Regeln: ab X Stunden Arbeit → Y Minuten Pause
- Standard-Regeln (konfigurierbar, aus DB übernommen):
  - ab 5:00h → 00:30h Pause
  - ab 8:00h → 00:45h Pause
  - ab 10:00h → 01:00h Pause
- Auswertungsreihenfolge: höchste zutreffende Regel (`highestThreshold`)
- Tatsächliche Pausen können gegen die Regel validiert werden

### F-04 Auto-Ausstempeln
- Automatisches Ausstempeln zu konfigurierter Uhrzeit (Standard: 20:00)
- Tage mit fehlendem Ausstempel werden markiert (`missingCheckout`)

### F-05 Soll-Zeit & Delta
- Konfigurierbare Soll-Zeit pro Wochentag (Standard: Mo–Fr 08:15, Sa/So 00:00)
- Delta = Ist-Zeit − Soll-Zeit, angezeigt pro Tag
- Positives Delta = Überstunden, negatives = Minusstunden
- Delta-Hervorhebung ab konfigurierbarem Schwellenwert (Standard: ±2h)

### F-06 Wochen- & Monatsübersicht
- Wochenübersicht: Ist, Soll, Delta pro Tag + Wochentotal
- Monatsübersicht: Ist, Soll, Delta pro Woche + Monatstotal
- ISO-Kalenderwochen anzeigen
- Erster Wochentag: Montag

### F-07 Balance Tracker / Flexzeit-Saldo
- Jahres-Saldo: kumuliertes Delta über das Jahr
- Urlaubsguthaben: Tage oder Stunden
- Jahres-Reset konfigurierbar

### F-08 Notizen pro Tag
- Freies Textfeld pro Arbeitstag
- In Tages- und Wochenansicht sichtbar

### F-09 Abwesenheits-Templates
- Vordefinierte Tages-Einträge die einen ganzen Tag füllen
- Standard-Templates: Urlaub, Feiertag, Kompensation
- Templates sind konfigurierbar (Name, Dauer)

### F-10 Reports / Export
- Export-Formate: PDF, Excel (.xlsx), HTML
- Zeitraum wählbar: Tag, Woche, Monat, benutzerdefiniert
- Inhalt: Stempelzeiten, Aufgaben, Delta, Notizen

### F-11 Zeitformat
- Anzeige wahlweise in HH:MM oder Dezimal (z.B. 8.50 statt 8:30)
- Umschaltbar in den Einstellungen

### F-12 Einstellungen
- Soll-Zeit pro Wochentag
- Auto-Pausen-Regeln
- Auto-Ausstempeln Uhrzeit
- Delta-Hervorhebungs-Schwellenwert
- Zeitformat (HH:MM / Dezimal)
- Arbeitstag Anzeige-Fenster (Standard: 07:00–20:00)

---

## Datenmigration

- Bestehende Daten aus `timerec.db.gz` via `sync.py` → JSON → Import-Script
- Einmaliger Import beim Setup

---

## Bewusst ausgeschlossen

| Feature | Grund |
|---------|-------|
| Geofencing / Standort-Tracking | Zu komplex, nicht benötigt |
| NFC-Tags | Später möglich (Hook vorsehen) |
| Wear OS | Nicht benötigt |
| Tasker / Broadcast-Integration | Nicht benötigt |
| Google Calendar Sync | Nicht benötigt |
| Punch Rules (Auto-Task-Wechsel) | Nicht benötigt |
| Paid Overtime / Lohnzuschläge | Nicht benötigt |
| Mehrsprachigkeit | Nur Deutsch |
| Widget / Push-Notifications | Später möglich (Hook vorsehen) |
| Multi-User / Team-Features | Nicht benötigt |

---

## Spätere Erweiterungen (Hooks vorsehen)

- NFC-Tag-Integration
- Home Screen Widget
- Push-Benachrichtigungen (z.B. Erinnerung ans Ausstempeln)
