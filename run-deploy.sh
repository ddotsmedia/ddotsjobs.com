#!/bin/bash
cd /opt/ddotsjobs

DB_PASS="f4192eb63d0090aab70fcd5cc98c09fa3a66bf0b53f66386"
APP_DIR="/opt/ddotsjobs"
BACKUP_DIR="$APP_DIR/backups"
TS=$(date +%Y%m%d_%H%M%S)

echo "==> [ddotsjobs] pulling latest"
git pull origin main

echo "==> [ddotsjobs] backup database"
mkdir -p "$BACKUP_DIR"
PGPASSWORD="$DB_PASS" pg_dump \
  -h 127.0.0.1 -p 5436 \
  -U ddotsjobs_user ddotsjobs \
  | gzip > "$BACKUP_DIR/ddotsjobs-$TS.sql.gz" \
  && echo "Backup OK" || echo "Backup skipped"
ls -1t "$BACKUP_DIR"/ddotsjobs-*.sql.gz \
  | tail -n +15 | xargs -r rm -f

echo "==> [ddotsjobs] clean .next"
rm -rf "$APP_DIR/apps/web/.next"

echo "==> [ddotsjobs] install deps"
NODE_ENV=development pnpm install --frozen-lockfile

echo "==> [ddotsjobs] build"
pnpm build

echo "==> [ddotsjobs] copy static assets"
STANDALONE="$APP_DIR/apps/web/.next/standalone/apps/web"
cp -r "$APP_DIR/apps/web/.next/static" \
  "$STANDALONE/.next/static"
[ -d "$APP_DIR/apps/web/public" ] && \
  cp -r "$APP_DIR/apps/web/public" \
  "$STANDALONE/public" || true

echo "==> [ddotsjobs] reload PM2"
pm2 reload ecosystem.config.js --only ddotsjobs-web
pm2 reload ecosystem.config.js --only ddotsjobs-worker
pm2 save

echo "==> [ddotsjobs] complete"
curl -s -o /dev/null -w "Health: %{http_code}\n" \
  http://localhost:3107

# bundle sizes
du -sh apps/web/.next/static/chunks/*.js 2>/dev/null | sort -h | tail -5
