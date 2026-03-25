/**
 * TimeRec Sync — Google Apps Script
 * 
 * Reads the Zeiterfassung backup (timerec.db.gz) from Google Drive
 * and pushes it to a GitHub repo, which triggers a GitHub Action
 * to parse the SQLite DB and generate JSON files.
 * 
 * SETUP:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire file
 * 3. Set the 3 constants below
 * 4. Run "setup()" once to create the daily trigger
 * 5. Run "syncToGitHub()" once manually to test
 */

// ═══════════════════════════════════════════
// CONFIG — set these 3 values
// ═══════════════════════════════════════════

// Your GitHub Personal Access Token (fine-grained, repo scope)
// Create at: https://github.com/settings/tokens?type=beta
// Permissions needed: Contents (read & write)
const GITHUB_TOKEN = "ghp_XXXXXXXXXXXXXXXXXX";

// Your GitHub repo in format "username/repo-name"
const GITHUB_REPO = "DEIN-USER/timerec-sync";

// Backup filename on Google Drive (search by name)
// The app creates "timerec-free.db.gz" or "timerec-pro.db.gz"
const BACKUP_FILENAME = "timerec-free.db.gz";

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

function syncToGitHub() {
  // 1. Find the backup file on Google Drive
  const files = DriveApp.getFilesByName(BACKUP_FILENAME);

  if (!files.hasNext()) {
    Logger.log("ERROR: Datei '" + BACKUP_FILENAME + "' nicht auf Google Drive gefunden!");
    return;
  }

  // Take the most recently modified file if multiple exist
  let latestFile = null;
  let latestDate = new Date(0);
  while (files.hasNext()) {
    const file = files.next();
    if (file.getLastUpdated() > latestDate) {
      latestDate = file.getLastUpdated();
      latestFile = file;
    }
  }

  Logger.log("Gefunden: " + latestFile.getName() +
    " (zuletzt geändert: " + latestDate.toISOString() + ")" +
    " — Grösse: " + latestFile.getSize() + " bytes");

  // 2. Read file content as base64
  const blob = latestFile.getBlob();
  const base64Content = Utilities.base64Encode(blob.getBytes());

  // 3. Check if file already exists on GitHub (we need the SHA to update)
  const filePath = "backup/timerec.db.gz";
  const apiUrl = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + filePath;

  let existingSha = null;
  const getResponse = UrlFetchApp.fetch(apiUrl, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json"
    },
    muteHttpExceptions: true
  });

  if (getResponse.getResponseCode() === 200) {
    const existing = JSON.parse(getResponse.getContentText());
    existingSha = existing.sha;
    Logger.log("Datei existiert auf GitHub, SHA: " + existingSha);
  } else {
    Logger.log("Datei existiert noch nicht auf GitHub, wird erstellt.");
  }

  // 4. Push to GitHub via Contents API
  const payload = {
    message: "backup: " + new Date().toISOString().substring(0, 10),
    content: base64Content
  };

  if (existingSha) {
    payload.sha = existingSha;
  }

  const putResponse = UrlFetchApp.fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = putResponse.getResponseCode();

  if (statusCode === 200 || statusCode === 201) {
    Logger.log("Erfolgreich nach GitHub gepusht! (" + statusCode + ")");
  } else {
    Logger.log("FEHLER beim Push: " + statusCode);
    Logger.log(putResponse.getContentText());
  }
}

// ═══════════════════════════════════════════
// SETUP — einmal ausführen
// ═══════════════════════════════════════════

function setup() {
  // Remove existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "syncToGitHub") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create daily trigger at 02:00-03:00 local time
  ScriptApp.newTrigger("syncToGitHub")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log("Daily trigger erstellt (02:00-03:00 Uhr).");
  Logger.log("Das Script läuft jetzt automatisch jede Nacht.");
}

// ═══════════════════════════════════════════
// HELPER — manuell testen
// ═══════════════════════════════════════════

function testDriveAccess() {
  const files = DriveApp.getFilesByName(BACKUP_FILENAME);
  if (files.hasNext()) {
    const file = files.next();
    Logger.log("Datei gefunden: " + file.getName());
    Logger.log("Grösse: " + file.getSize() + " bytes");
    Logger.log("Zuletzt geändert: " + file.getLastUpdated());
    Logger.log("Drive-Pfad: " + file.getUrl());
  } else {
    Logger.log("NICHT GEFUNDEN: " + BACKUP_FILENAME);
    Logger.log("Tipp: Mach zuerst ein Backup in der Zeiterfassung App auf Google Drive.");
  }
}
