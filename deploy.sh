#!/bin/bash
set -e

# Atrani.ru deploy script
# Usage: ./deploy.sh
# Run on VPS from the project directory: /home/greg/atraniru

APP_DIR="/home/greg/atraniru"
QUEUE_DIR="$APP_DIR/data/queue"

cd "$APP_DIR"

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
