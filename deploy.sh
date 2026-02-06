#!/bin/bash
set -e

# Atrani.ru deploy script
# Usage: ./deploy.sh
# Run on VPS from the project directory: /home/greg/atraniru

APP_DIR="/home/greg/atraniru"
QUEUE_DIR="$APP_DIR/data/queue"

cd "$APP_DIR"

# Check .env exists with Ghost credentials
if [ ! -f .env ] || ! grep -q "GHOST_URL" .env || ! grep -q "CONTENT_API_KEY" .env; then
  echo "ERROR: .env missing or incomplete (need GHOST_URL and CONTENT_API_KEY)"
  echo "Create .env with:"
  echo "  GHOST_URL=http://localhost:2369"
  echo "  CONTENT_API_KEY=<your-ghost-content-api-key>"
  exit 1
fi

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Installing dependencies ==="
npm ci

echo "=== Creating queue directories ==="
mkdir -p "$QUEUE_DIR/pending" "$QUEUE_DIR/delivered"

echo "=== Building ==="
npm run build

echo "=== Restarting with PM2 ==="
if pm2 describe atraniru > /dev/null 2>&1; then
  pm2 restart atraniru
else
  pm2 start ecosystem.config.cjs --only atraniru
fi

echo "=== Done! ==="
pm2 status atraniru
