#!/bin/bash
set -e

# Rebuild script — called by webhook.mjs when Ghost publishes/updates a post.
# Pulls latest code, installs deps, and rebuilds the static site.
#
# Unlike deploy.sh (which is run manually), this script:
# - Logs with timestamps
# - Skips interactive prompts
# - Is safe to run concurrently (webhook.mjs handles queuing)

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_PREFIX="[rebuild]"

cd "$APP_DIR"

echo "$LOG_PREFIX Starting at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Validate .env
if [ ! -f .env ] || ! grep -q "GHOST_URL" .env || ! grep -q "CONTENT_API_KEY" .env; then
  echo "$LOG_PREFIX ERROR: .env missing or incomplete"
  exit 1
fi

# Pull latest code
echo "$LOG_PREFIX Pulling latest code..."
git pull origin main --ff-only 2>&1

# Install deps (only if package-lock changed)
if git diff HEAD~1 --name-only 2>/dev/null | grep -q "package-lock.json"; then
  echo "$LOG_PREFIX package-lock.json changed, running npm ci..."
  npm ci 2>&1
else
  echo "$LOG_PREFIX Dependencies unchanged, skipping npm ci"
fi

# Build
echo "$LOG_PREFIX Building static site..."
npm run build 2>&1

echo "$LOG_PREFIX Done at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
