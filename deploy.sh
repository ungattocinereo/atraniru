#!/usr/bin/env bash
set -Eeuo pipefail

# Atrani.ru deployment entry point.
#
#   ./deploy.sh                 Fetch and fast-forward main, install dependencies,
#                               build a release, activate it, and restart services.
#   ./deploy.sh --rebuild-only  Build and activate the current committed revision.
#                               Used by the Ghost webhook; it never pulls code or
#                               restarts the webhook process that invoked it.

APP_DIR="${ATRANI_APP_DIR:-/srv/atraniru}"
BACKUP_ROOT="${ATRANI_BACKUP_DIR:-/srv/atraniru-backups}"
LOCK_FILE="${ATRANI_DEPLOY_LOCK:-/tmp/atraniru-deploy.lock}"
MODE="${1:-deploy}"
BUILD_DIR=""
PREVIOUS_DIST=""
DIST_ACTIVATED=0

log() {
  printf '[deploy] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

cleanup() {
  if [[ -n "$BUILD_DIR" && "$BUILD_DIR" == "$APP_DIR/.deploy-build."* && -d "$BUILD_DIR" ]]; then
    rm -rf -- "$BUILD_DIR"
  fi
}

rollback_dist() {
  if [[ "$DIST_ACTIVATED" -eq 1 && -n "$PREVIOUS_DIST" && -d "$PREVIOUS_DIST" ]]; then
    log "Restoring the previous static release"
    if [[ -d "$APP_DIR/dist" ]]; then
      mv "$APP_DIR/dist" "$BACKUP_ROOT/failed-dist-$(date -u '+%Y%m%dT%H%M%SZ')"
    fi
    mv "$PREVIOUS_DIST" "$APP_DIR/dist"
    DIST_ACTIVATED=0
  fi
}

on_error() {
  local status=$?
  rollback_dist || true
  cleanup
  exit "$status"
}

wait_for_webhook() {
  local attempt
  for attempt in {1..15}; do
    if curl --fail --silent --max-time 2 \
      http://127.0.0.1:13103/webhook/health >/dev/null; then
      log "Webhook service is ready"
      return 0
    fi
    sleep 1
  done

  log "ERROR: webhook service did not become ready within 15 seconds"
  return 1
}

case "$MODE" in
  deploy|--rebuild-only) ;;
  *) die "Usage: $0 [--rebuild-only]" ;;
esac

command -v flock >/dev/null 2>&1 || die "flock is required"
exec 9>"$LOCK_FILE"
flock -n 9 || die "another deploy or rebuild is already running"

[[ -d "$APP_DIR/.git" ]] || die "repository not found at $APP_DIR"
cd "$APP_DIR"

[[ -f .env ]] || die ".env is missing"
grep -Eq '^GHOST_URL=.+' .env || die "GHOST_URL is missing from .env"
grep -Eq '^CONTENT_API_KEY=.+' .env || die "CONTENT_API_KEY is missing from .env"

if [[ "$MODE" == "deploy" ]]; then
  [[ -z "$(git status --porcelain --untracked-files=all)" ]] || \
    die "working tree is not clean; preserve or commit server changes first"

  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "main" ]] || die "full deployment must run from main"

  log "Fetching origin/main"
  git fetch origin main
  git merge --ff-only origin/main

  log "Installing locked dependencies"
  npm ci
else
  [[ -d node_modules ]] || die "node_modules is missing; run a full deploy first"
fi

sudo install -d -o "$(id -un)" -g "$(id -gn)" "$BACKUP_ROOT"
BUILD_DIR="$(mktemp -d "$APP_DIR/.deploy-build.XXXXXX")"
trap on_error ERR INT TERM
trap cleanup EXIT

log "Preparing isolated release from $(git rev-parse --short HEAD)"
git archive HEAD | tar -x -C "$BUILD_DIR"
install -m 600 .env "$BUILD_DIR/.env"
ln -s "$APP_DIR/node_modules" "$BUILD_DIR/node_modules"

log "Building static site"
(
  cd "$BUILD_DIR"
  npm run build
)

for required_file in dist/index.html dist/sitemap-index.xml dist/llms.txt; do
  [[ -s "$BUILD_DIR/$required_file" ]] || die "release is missing $required_file"
done

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
if [[ -d "$APP_DIR/dist" ]]; then
  PREVIOUS_DIST="$BACKUP_ROOT/dist-$timestamp"
  log "Backing up current static release to $PREVIOUS_DIST"
  mv "$APP_DIR/dist" "$PREVIOUS_DIST"
fi

log "Activating validated static release"
mv "$BUILD_DIR/dist" "$APP_DIR/dist"
DIST_ACTIVATED=1

[[ -s "$APP_DIR/dist/index.html" ]] || die "activated release is not readable"

if [[ "$MODE" == "deploy" ]]; then
  log "Installing and restarting webhook service"
  sudo install -m 0644 "$APP_DIR/atraniru-webhook.service" /etc/systemd/system/atraniru-webhook.service
  sudo systemctl daemon-reload
  sudo systemctl enable atraniru-webhook
  sudo systemctl restart atraniru-webhook

  wait_for_webhook

  log "Reloading shared Caddy configuration"
  # The repository Caddyfile is an Atrani reference fragment. The server-wide
  # /etc/caddy/Caddyfile is shared with other sites and must never be replaced.
  sudo systemctl reload caddy

fi

DIST_ACTIVATED=0
log "Deployment complete; static files are in $APP_DIR/dist"
