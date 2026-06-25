#!/usr/bin/env bash
# ddotsjobs one-time VPS bootstrap — /opt/ddotsjobs/startup.sh
# Idempotent. Provisions ONLY ddotsjobs infra. Never touches the 12 other
# projects, never drops/truncates anything. Re-runnable safely.
set -euo pipefail

APP_DIR=/opt/ddotsjobs
LOG_DIR=/var/log/ddotsjobs
PG_VERSION=16
PG_CLUSTER=ddotsjobs
PG_PORT=5436
PGB_PORT=6432
DB_NAME=ddotsjobs
DB_USER=ddotsjobs_user
MEILI_PORT=7700
MEILI_CONTAINER=ddotsjobs-search
MEILI_VOLUME=ddotsjobs-meili-data

require_root() { [ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }; }
require_root

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "ERROR: $APP_DIR/.env.production missing. Create it from .env.example first."
  exit 1
fi
# shellcheck disable=SC1091
set -a; . "$APP_DIR/.env.production"; set +a

echo "==> [ddotsjobs] dirs"
mkdir -p "$LOG_DIR" "$APP_DIR/backups" /var/www/certbot /etc/nginx/snippets

# ── Isolated PostgreSQL 16 cluster on 5436 ──────────────────────────────
echo "==> [ddotsjobs] postgres cluster"
if ! pg_lsclusters -h 2>/dev/null | awk '{print $1"/"$2}' | grep -qx "$PG_VERSION/$PG_CLUSTER"; then
  pg_createcluster "$PG_VERSION" "$PG_CLUSTER" -p "$PG_PORT" -- --encoding=UTF8 --locale=en_IN.UTF-8 || \
  pg_createcluster "$PG_VERSION" "$PG_CLUSTER" -p "$PG_PORT"
fi
pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start || true

PSQL=(psql -p "$PG_PORT" -h /var/run/postgresql -U postgres -v ON_ERROR_STOP=1)

# Role (create if absent — never alter existing other-project roles).
if ! "${PSQL[@]}" -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  DB_PASS="${DB_PASSWORD:-$(openssl rand -hex 24)}"
  "${PSQL[@]}" -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
  echo "    created role $DB_USER (set DATABASE_URL password to match)"
fi

# Database.
if ! "${PSQL[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  "${PSQL[@]}" -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# Extensions (idempotent).
psql -p "$PG_PORT" -h /var/run/postgresql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# ── PgBouncer (transaction pooling) on 6432 ─────────────────────────────
echo "==> [ddotsjobs] pgbouncer note"
echo "    Ensure /etc/pgbouncer/pgbouncer.ini has a [databases] line:"
echo "    $DB_NAME = host=127.0.0.1 port=$PG_PORT dbname=$DB_NAME"
echo "    pool_mode=transaction, listen_port=$PGB_PORT. Reload: systemctl reload pgbouncer"

# ── Meilisearch (Docker, named volume, localhost only) ──────────────────
echo "==> [ddotsjobs] meilisearch"
docker volume inspect "$MEILI_VOLUME" >/dev/null 2>&1 || docker volume create "$MEILI_VOLUME"
if ! docker ps -a --format '{{.Names}}' | grep -qx "$MEILI_CONTAINER"; then
  docker run -d --name "$MEILI_CONTAINER" --restart unless-stopped \
    -p 127.0.0.1:${MEILI_PORT}:7700 \
    -e MEILI_MASTER_KEY="${MEILISEARCH_MASTER_KEY:?set MEILISEARCH_MASTER_KEY}" \
    -e MEILI_ENV=production \
    -v "$MEILI_VOLUME":/meili_data \
    getmeili/meilisearch:v1.11
else
  docker start "$MEILI_CONTAINER" >/dev/null 2>&1 || true
fi

# ── Node / pnpm / pm2 toolchain ─────────────────────────────────────────
echo "==> [ddotsjobs] toolchain"
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@9
command -v pm2  >/dev/null 2>&1 || npm install -g pm2

# ── Nginx vhost (additive, separate file) ───────────────────────────────
echo "==> [ddotsjobs] nginx"
cp "$APP_DIR/nginx/snippets/ddotsjobs-proxy.conf" /etc/nginx/snippets/ddotsjobs-proxy.conf
cp "$APP_DIR/nginx/ddotsjobs.conf" /etc/nginx/sites-available/ddotsjobs
ln -sf /etc/nginx/sites-available/ddotsjobs /etc/nginx/sites-enabled/ddotsjobs
if nginx -t; then systemctl reload nginx; else echo "    nginx -t failed (TLS cert may be pending certbot) — skipping reload"; fi

# ── First deploy (build + PM2 boot) ─────────────────────────────────────
echo "==> [ddotsjobs] first deploy"
chmod +x "$APP_DIR/deploy.sh"
"$APP_DIR/deploy.sh"

pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save

echo "==> [ddotsjobs] bootstrap complete"
echo "    Next: obtain TLS cert ->"
echo "    certbot certonly --webroot -w /var/www/certbot -d ddotsjobs.com -d www.ddotsjobs.com"
echo "    then: nginx -t && systemctl reload nginx"
