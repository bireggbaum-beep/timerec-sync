#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env fehlt. Kopiere .env.example und setze COUCHDB_PASSWORD."
  exit 1
fi

echo "→ App bauen..."
cd app && npm ci && npm run build && cd ..

echo "→ Daten kopieren..."
cp -r data app/dist/data

echo "→ Docker starten..."
docker compose up -d

echo "✓ Deployed. App läuft auf http://localhost"
