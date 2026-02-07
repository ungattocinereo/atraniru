#!/bin/bash
set -e

# Atrani.ru deploy script (static site + Ghost CMS + webhook)
# Usage: ./deploy.sh
# Run on VPS from the project directory: /home/greg/atraniru
#
# Architecture:
#   Caddy serves Astro static files from dist/
#   Ghost (Docker, port 40002) is headless CMS only
#   Webhook server (port 40003) triggers rebuild on Ghost publish or GitHub push
#   Caddy proxies /blog/ghost/*, /blog/content/*, /webhook/*, /hooks/* to port 40003
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
#       # Ghost Content API (needed at build time from VPS itself)
#       handle /blog/ghost/api/* {
#           reverse_proxy localhost:40002
#       }
#
#       # Webhook server (Ghost + GitHub rebuild triggers)
#       handle /webhook/* {
#           reverse_proxy localhost:40003
#       }
#
#       # GitHub webhook (redeploy on push)
#       handle /hooks/* {
#           reverse_proxy localhost:40003
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

# Check .env exists with required credentials
if [ ! -f .env ] || ! grep -q "GHOST_URL" .env || ! grep -q "CONTENT_API_KEY" .env; then
  echo "ERROR: .env missing or incomplete"
  echo "Create .env with:"
  echo "  GHOST_URL=http://localhost:40002/blog"
  echo "  GHOST_PUBLIC_URL=https://atrani.ru/blog"
  echo "  CONTENT_API_KEY=<your-ghost-content-api-key>"
  echo "  WEBHOOK_SECRET=<random-secret>"
  exit 1
fi

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Installing dependencies ==="
npm ci

echo "=== Building static site ==="
npm run build

echo "=== Setting up webhook server ==="
# Install systemd service if not already installed
if [ ! -f /etc/systemd/system/atraniru-webhook.service ]; then
  echo "Installing webhook systemd service..."
  sudo cp "$APP_DIR/atraniru-webhook.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable atraniru-webhook
fi

# Restart webhook server
sudo systemctl restart atraniru-webhook

echo ""
echo "=== Done! ==="
echo "Static files in: $APP_DIR/dist"
echo ""
echo "Next steps (first deploy only):"
echo "  1. Update Caddy config: sudo nano /etc/caddy/Caddyfile"
echo "  2. Reload Caddy: sudo systemctl reload caddy"
echo "  3. Add Ghost webhook: Ghost Admin → Settings → Integrations"
echo "     Event: Post published"
echo "     URL: https://atrani.ru/webhook/rebuild?secret=YOUR_WEBHOOK_SECRET"
