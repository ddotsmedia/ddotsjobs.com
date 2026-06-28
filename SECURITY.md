# Security

**Audit date:** June 2026 · **Next audit due:** December 2026

## Measures implemented

### 1. HTTP security headers (`apps/web/next.config.ts`)
- Content-Security-Policy (self + allowlists: Razorpay, Google Fonts, R2, Green API; `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 2. Input validation + sanitization
- `lib/sanitize.ts` (isomorphic-dompurify): `sanitizeHtml` (allow b/i/u/ul/ol/li/br/p) + `stripHtml`.
- Applied server-side at save: jobs (title strip / description sanitize), reviews (body sanitize), applications (answer strip), employer (names strip).
- Cross-field rules: `salaryMax >= salaryMin`, `validThrough` must be future. Ratings constrained 1–5 in DB. Slugs server-generated, never user input.

### 3. Authentication
- Auth.js v5, JWT (HS256), session 30d. OTP single-use (cleared after verify).
- OTP rate limit: 5 requests/hour per phone; 5 failed verifications → phone blocked 1h. OTP format `^\d{6}$`.
- Role-scoped tRPC: employer procedures resolve `employers.owner_user_id` from DB; admin via `roleProcedure('admin','super_admin')`. Middleware gates `/admin`, `/employer`, `/seeker`; webhooks are unauthenticated but signature-verified.

### 4. API security
- Redis fixed-window rate limiting (`server/rate-limit.ts`): jobs.create 10/h, applications.create 20/day, reviews.submit 5/day, resume 10/day, interview 20/day, cover-letter 20/day.
- Razorpay webhook: raw-body HMAC verify + replay prevention (`SET NX webhook:seen:{paymentId}`, 24h).
- File uploads validated server-side (mime + size); keys stored as `{scope}/{id}/{ts}`, never original filenames.

### 5. Database
- All queries via Drizzle parameterized statements / `sql` template params — no string interpolation (audited).
- Phone numbers & OTP codes never logged. OTP keys TTL 600s. No passwords stored (OTP-only).
- `audit_log` records admin actions, employer/job approvals, account-deletion + suspicious-OTP events.

### 6. Privacy
- Seeker phone/email never returned by public APIs or talent pool. `visibility='private'` excluded from talent pool/search.
- `account.requestDeletion` (GDPR-style) flags `users.deletion_requested_at`; processed within 30 days. Soft-delete only. Privacy policy at `/privacy`.

### 7. Dependencies
- `pnpm audit`: Next.js bumped 15.1.3 → **15.5.19** — clears both criticals (React-flight RCE, **CVE-2025-29927 middleware auth-bypass**) + the high-severity middleware advisories. Remaining: a few moderate/low transitive advisories (no known exploit path for our usage) — tracked for the next dependency sweep.
- `.env.production` is git-ignored (chmod 600 on VPS) and absent from git history. `backups/` git-ignored.

### 8. Error handling
- tRPC masks `INTERNAL_SERVER_ERROR` in production (generic message to client, full error logged server-side). Custom `error.tsx` / `not-found.tsx` leak no internals.

## Notes / follow-ups
- Page-level middleware gating is defense-in-depth; **authorization is also enforced server-side in every tRPC procedure**, so a middleware bypass cannot expose data.
- Remaining moderate `pnpm audit` items to be reviewed in the December 2026 sweep.
