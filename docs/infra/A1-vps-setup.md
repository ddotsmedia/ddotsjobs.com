# A1 — VPS Infrastructure Setup

Executed on `194.164.151.202` (Hostinger Ubuntu 24). Isolated from the 12 other
projects. No secrets in this file.

## Provisioned

| Component | Detail | State |
|---|---|---|
| Repo | `/opt/ddotsjobs` ← `git@github.com:ddotsmedia/ddotsjobs.com.git` | cloned |
| `.env.production` | infra secrets generated, `chmod 600`; third-party keys blank | written |
| PostgreSQL | isolated cluster `16/ddotsjobs` on **:5436** | online |
| Role / DB | `ddotsjobs_user` / `ddotsjobs` (owner) | created |
| Extensions | `uuid-ossp`, `pgcrypto`, `vector` (pkg `postgresql-16-pgvector`), `pg_trgm`, `plpgsql` | installed |
| Migration | `migrations/0001_initial.sql` | applied |
| Schema | **24 tables, 16 enums, 89 indexes**, `jobs` tsv + `updated_at` triggers | verified |
| PgBouncer | **:6432** → :5436, transaction pool, SCRAM userlist | active, pooled conn verified |
| Meilisearch | docker `ddotsjobs-search` `v1.7`, vol `ddotsjobs_meili_data`, `127.0.0.1:7700`, 512m/0.5cpu | health `available` |
| Redis | shared host `127.0.0.1:6379` (prefix `ddotsjobs:`) | PONG |
| PM2 | `pm2 startup systemd` + `pm2 save` | configured |
| Nginx | vhost + snippet copied to `sites-available`, global `nginx -t` OK | **staged, NOT enabled** |

## Deferred (blocked, intentional)

- **Nginx enable** — vhost requires Let's Encrypt cert for `ddotsjobs.com`; no
  cert/DNS yet and `:3100` has no listener (app not built). Enabling a
  cert-less / dead-upstream vhost would risk the 12 live sites on next reload.
  Enable at go-live (H1) after cert + Cloudflare. Files are in place.
- **Third-party API keys** in `.env.production` (Anthropic, Razorpay, Resend,
  Green API, Cloudflare R2) — must be filled before the first app deploy (A2+).

## Isolation honored

New PG cluster (not shared `16/main`), dedicated Meili container, fresh
PgBouncer config (was not installed), separate nginx vhost file, prefixed Redis
keys. No other project touched. No destructive operations.
