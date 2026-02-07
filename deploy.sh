#!/bin/bash
set -e

# Atrani.ru deploy script (static site + Ghost CMS)
# Usage: ./deploy.sh
# Run on VPS from the project directory: /home/greg/atraniru
#
# Architecture:
#   Caddy serves Astro static files from dist/
#   Ghost (Docker, port 40002) is headless CMS only
#   Caddy proxies /blog/ghost/* and /blog/content/* to Ghost
#   Everything else served from dist/
#
# Required Caddy config (/etc/caddy/Caddyfile):
#
#   atrani.ru {
#       # Ghost admin panel
#       handle /blog/ghost/* {
#           reverse_proxy localhost:40002
#       }
#
#       # Ghost uploaded images
#       handle /blog/content/* {
#           reverse_proxy localhost:40002
#       }
#
#       # Astro static site (all other routes including /blog/*)
#       handle {
#           root * /home/greg/atraniru/dist
#           try_files {path} {path}/index.html {path}.html
#           file_server
#       }
#   }

APP_DIR="/home/greg/atraniru"

cd "$APP_DIR"

# Check .env exists with Ghost credentials
if [ ! -f .env ] || ! grep -q "GHOST_URL" .env || ! grep -q "CONTENT_API_KEY" .env; then
  echo "ERROR: .env missing or incomplete"
  echo "Create .env with:"
  echo "  GHOST_URL=http://localhost:40002/blog"
  echo "  GHOST_PUBLIC_URL=https://atrani.ru/blog"
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
echo ""
echo "If blog still shows Ghost default theme, update Caddy config:"
echo "  sudo nano /etc/caddy/Caddyfile"
echo "  sudo systemctl reload caddy"
