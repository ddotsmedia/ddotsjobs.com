#!/usr/bin/env bash
# ddotsjobs deploy — VPS /opt/ddotsjobs/deploy.sh
# Touches ONLY ddotsjobs. Never restarts other projects.
set -euo pipefail

APP_DIR=/opt/ddotsjobs
LOG_DIR=/var/log/ddotsjobs

cd "$APP_DIR"

echo "==> [ddotsjobs] pulling latest"
git fetch --prune origin
git reset --hard origin/main

echo "==> [ddotsjobs] backup database before migrate"
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"
TS=$(date +%Y%m%d-%H%M%S)
pg_dump -p 5436 -U ddotsjobs_user ddotsjobs | gzip > "$BACKUP_DIR/ddotsjobs-$TS.sql.gz"
# keep last 14 backups
ls -1t "$BACKUP_DIR"/ddotsjobs-*.sql.gz | tail -n +15 | xargs -r rm -f

echo "==> [ddotsjobs] clean web .next (mandatory)"
rm -rf "$APP_DIR/apps/web/.next"

echo "==> [ddotsjobs] install deps"
pnpm install --frozen-lockfile

echo "==> [ddotsjobs] run additive migrations"
pnpm --filter @ddotsjobs/db migrate

echo "==> [ddotsjobs] build"
pnpm build

echo "==> [ddotsjobs] reload PM2 (zero-downtime)"
pm2 reload ecosystem.config.js --only ddotsjobs-web
pm2 reload ecosystem.config.js --only ddotsjobs-worker
pm2 save

echo "==> [ddotsjobs] deploy complete"
