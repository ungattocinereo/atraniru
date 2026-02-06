#!/bin/bash
set -e

# Atrani.ru deploy script (static site)
# Usage: ./deploy.sh
# Run on VPS from the project directory: /home/greg/atraniru
# Nginx should serve files from /home/greg/atraniru/dist

APP_DIR="/home/greg/atraniru"

cd "$APP_DIR"

# Check .env exists with Ghost credentials
if [ ! -f .env ] || ! grep -q "GHOST_URL" .env || ! grep -q "CONTENT_API_KEY" .env; then
  echo "ERROR: .env missing or incomplete (need GHOST_URL and CONTENT_API_KEY)"
  echo "Create .env with:"
  echo "  GHOST_URL=http://localhost:2369"
  echo "  GHOST_PUBLIC_URL=https://atrani.ru/blog/ghost"
  echo "  CONTENT_API_KEY=<your-ghost-content-api-key>"
  exit 1
fi

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Installing dependencies ==="
npm ci

echo "=== Building static site ==="
npm run build

echo "=== Done! ==="
echo "Static files in: $APP_DIR/dist"
echo "Nginx should serve from this directory."
