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

echo ""
echo "✓ Deployed. App läuft auf http://localhost"
echo ""
echo "→ Warte auf Cloudflare Tunnel URL..."
sleep 5
TUNNEL_URL=$(docker compose logs cloudflared 2>&1 | grep -o 'https://.*trycloudflare.com' | tail -1)
if [ -n "$TUNNEL_URL" ]; then
  echo "✓ Tunnel: $TUNNEL_URL"
else
  echo "⚠ Tunnel-URL noch nicht verfügbar. Prüfe mit:"
  echo "  docker compose logs cloudflared | grep trycloudflare"
fi
