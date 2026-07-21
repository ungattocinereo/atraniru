#!/usr/bin/env bash
set -Eeuo pipefail

# Ghost publish/update hook: rebuild the current committed release without
# pulling code or restarting the webhook service that invoked this script.
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

exec "$APP_DIR/deploy.sh" --rebuild-only
