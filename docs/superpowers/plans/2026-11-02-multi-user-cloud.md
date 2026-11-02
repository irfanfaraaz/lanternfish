# Multi-user Cloud Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per the project's gate: do NOT run tests/typecheck per task; the full checks run once at the end. Only the main agent runs git.

**Goal:** One Lanternfish Worker that, with `MODE=cloud`, lets anyone sign up with email + password, keeps each account's sites and data isolated, and enforces per-account limits, while `MODE` unset behaves exactly as today.

**Architecture:** Sessions carry the account id; `authenticate` puts `accountId` on the Hono context and every API route scopes by it instead of the `ACCOUNT_ID = 1` constant. A new `src/worker/accounts.ts` owns sign-up, password and deletion; `src/worker/limits.ts` owns per-account usage. Cron walks every site.

**Tech Stack:** Cloudflare Workers, D1, Hono 4, Preact + preact-iso, Vitest with `@cloudflare/vitest-plugin`, Bun.

**Spec:** `docs/superpowers/specs/2026-11-02-multi-user-cloud-design.md`

## Global Constraints

- `MODE` default `"self"`; `"cloud"` enables accounts and limits. Any other value is treated as `"self"`.
- Defaults: `SIGNUPS=open`, `ACCOUNT_DAILY_EVENTS=10000`, `ACCOUNT_DAILY_READS=500000`, `ACCOUNT_MAX_SITES=10`, `CRON_QUERY_BUDGET=40`. Non-positive/unparsable → default.
- Self mode adds no D1 write per event and no extra read on ingest.
- No new runtime dependencies. Migrations only add (`migrations/0002_accounts.sql`).
- Password: 12–200 characters; email: trimmed, lower-cased, ≤ 254 chars, matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Session token format: `${accountId}.${gen}.${exp}.${sig}`, `sig = hmacB64url(SESSION_SECRET, \`session:${accountId}:${gen}:${exp}\`)`, 30-day expiry.
- Messages are short and plain, matching existing ones ("Wrong password", "Owner only").
- Visitor privacy behaviour and README privacy text unchanged.

## Review Focus

1. **Cross-account access by guessing a site id** → 404 on every `/api/sites/:id*` route (GET, PATCH, DELETE, rotate-key, share, share/revoke, stats, realtime, export.csv, data). Test in Task 2.
2. **Email case/whitespace** (`" Me@X.com "` then `"me@x.com"`) → same account; sign-up with the second form → 409. Test in Task 3.
3. **Old v1 session cookie after upgrade** (`exp.sig`) → 401, not a crash. Test in Task 2.
4. **Session after password change or account deletion** → 401 on other devices. Test in Task 3.
5. **Account at its event cap while the install has budget left** → that account's events dropped, another account's events stored. Test in Task 4.

---

## File map

| File | Responsibility |
|---|---|
| `migrations/0002_accounts.sql` (new) | accounts columns, `account_usage`, `sites_account` index |
| `src/worker/env.ts` | new vars on `Env` |
| `src/worker/config.ts` (new) | `isCloud`, limit getters |
| `src/worker/auth.ts` | v2 session tokens, `accountId` context, self/cloud login |
| `src/worker/accounts.ts` (new) | sign-up, change password, delete account, email/password checks |
| `src/worker/limits.ts` (new) | per-account usage reads/writes and checks |
| `src/worker/api.ts` | scope by `accountId`, new routes, limits |
| `src/worker/sites.ts` | `listAllSites`, `ownedSite` moves here |
| `src/worker/ingest.ts`, `server-events.ts`, `public.ts` | account caps + usage (cloud only) |
| `src/worker/cron.ts` | all sites, configurable budget, rotating start |
| `src/shared/types.ts` | `Me`, `Usage.scope` |
| `src/dashboard/pages/Login.tsx`, `pages/Account.tsx` (new), `app.tsx`, `components/Shell.tsx` | cloud UI |
| `README.md`, `CHANGELOG.md`, `scripts/setup.ts`, `wrangler.jsonc` | docs, `--cloud` setup, `MODE` var |
| `test/worker/helpers.ts`, `vitest.config.ts` | cloud-mode helpers |

---

### Task 1: Schema, config and env

**Waits for:** nothing.

**Files:**
- Create: `migrations/0002_accounts.sql`, `src/worker/config.ts`
- Modify: `src/worker/env.ts`, `wrangler.jsonc` (add `"MODE": "self"` to `vars`, with a comment line above `vars` naming the other new vars and their defaults)
- Test: `test/worker/schema.test.ts`, `test/worker/primitives.test.ts`

**Interfaces — Produces:**
- `Env` gains optional `MODE`, `SIGNUPS`, `ACCOUNT_DAILY_EVENTS`, `ACCOUNT_DAILY_READS`, `ACCOUNT_MAX_SITES`, `CRON_QUERY_BUDGET` (all `string | undefined`).
- `config.ts`: `isCloud(env: Pick<Env,"MODE">): boolean`; `signupsOpen(env): boolean` (true unless `SIGNUPS === "closed"`); `accountDailyEvents(env): number`; `accountDailyReads(env): number`; `accountMaxSites(env): number`; `cronQueryBudget(env): number`. Move the `positive()` helper from `usage.ts` here and import it back into `usage.ts`.
- SQL: `ALTER TABLE accounts ADD COLUMN password_hash TEXT;` `ALTER TABLE accounts ADD COLUMN session_gen INTEGER NOT NULL DEFAULT 0;` `CREATE TABLE account_usage (account_id INTEGER NOT NULL, day TEXT NOT NULL, events INTEGER NOT NULL DEFAULT 0, rows_written INTEGER NOT NULL DEFAULT 0, rows_read INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (account_id, day));` `CREATE INDEX sites_account ON sites (account_id);`

- [ ] **Step 1: Tests.** In `schema.test.ts`: `accounts` has columns `password_hash`, `session_gen`; `account_usage` exists with primary key `(account_id, day)`; index `sites_account` exists. In `primitives.test.ts`: `isCloud({MODE:"cloud"})` true, `isCloud({})` and `isCloud({MODE:"x"})` false; `accountDailyEvents({})` 10000, `({ACCOUNT_DAILY_EVENTS:"-1"})` 10000, `({ACCOUNT_DAILY_EVENTS:"25"})` 25; same pattern for reads (500000), max sites (10), cron budget (40); `signupsOpen({SIGNUPS:"closed"})` false, `({})` true.
- [ ] **Step 2: Implement** the migration, `config.ts` and `env.ts` changes.
- [ ] **Step 3: Report** files changed to the main agent (main agent commits: `feat: schema and config for cloud mode`).

### Task 2: Account-scoped sessions and API isolation

**Waits for:** Task 1.

**Files:**
- Modify: `src/worker/auth.ts`, `src/worker/api.ts`, `src/worker/sites.ts`, `src/worker/cron.ts` (only remove its local `ACCOUNT_ID`, use `listAllSites`; leave budget logic to Task 5)
- Modify: `test/worker/helpers.ts`, `test/worker/auth.test.ts`, `test/worker/api.test.ts`
- Create: `test/worker/isolation.test.ts`

**Interfaces — Consumes:** Task 1 schema. **Produces:**
- `issueSession(secret: string, accountId: number, gen: number, nowSec: number): Promise<string>`
- `readSession(token: string | undefined, secret: string, nowSec: number): Promise<{ accountId: number; gen: number } | null>` (replaces `verifySession`; rejects 3-part legacy tokens)
- `authenticate` looks up `SELECT session_gen FROM accounts WHERE id = ?` and requires it to equal the token's `gen`.
- `AuthVars = { owner: boolean; accountId: number | null; shareSite: string | null }`; `owner === (accountId !== null)`.
- `setSessionCookie(c, accountId: number, gen: number): Promise<void>` exported from `auth.ts` (used by Task 3).
- `sites.ts`: `ownedSite(db, id: string, accountId: number): Promise<Site | null>` (moved from `api.ts`), `listAllSites(db): Promise<Site[]>`. Remove `ACCOUNT_ID` export from `api.ts`.
- In `api.ts`, a helper `siteFor(c)` returns: for owners `ownedSite(db, id, accountId)`; for share mode `getSite(db, shareSite)` when the param equals `shareSite`.
- DELETE statements in `/sites/:id` and `/sites/:id/data` stay keyed on the already-owned `site.id`; the final `DELETE FROM sites` adds `AND account_id = ?`.
- Self-mode `login` keeps `{ password }` + `OWNER_PASSWORD_HASH` and issues a session for account 1 with its current `session_gen`.
- Test helpers: `seedAccount(email: string, password: string): Promise<number>` (inserts with `hashPassword`), `sessionFor(accountId: number): Promise<string>` returning a `lf_session=...` cookie built with `issueSession` and `"test-secret-0123456789"`, and `call(req, envOver?: Partial<Env>)` that merges `envOver` onto `env`. `reset()` also clears `account_usage` and deletes accounts with `id <> 1`, resetting account 1's `session_gen` to 0.

- [ ] **Step 1: Tests.** `auth.test.ts`: update to new token shape; a legacy `${exp}.${sig}` cookie → 401; a token with `gen` 0 after `UPDATE accounts SET session_gen = 1 WHERE id = 1` → 401. `isolation.test.ts`: seed account 2 with site `b2site` and account 1's site `abc123`; with account 2's session, each of GET `/sites/abc123`, PATCH, DELETE, POST `rotate-key`, `share`, `share/revoke`, GET `stats`, `realtime`, `export.csv`, DELETE `data?all=1` → 404, and `abc123` row is unchanged afterwards; GET `/sites` and `/sites/list` for account 2 return only `b2site`. Existing api tests keep passing with the owner session.
- [ ] **Step 2: Implement** per the Interfaces above.
- [ ] **Step 3: Report** to main agent (commit: `feat: sessions carry the account; API scoped per account`).

### Task 3: Cloud sign-up, sign-in, password change, account deletion

**Waits for:** Task 2.

**Files:**
- Create: `src/worker/accounts.ts`, `test/worker/accounts.test.ts`
- Modify: `src/worker/auth.ts` (`login` branches on `isCloud`), `src/worker/api.ts` (routes), `src/shared/types.ts`

**Interfaces — Consumes:** `isCloud`, `signupsOpen`, limit getters (Task 1); `setSessionCookie`, `AuthVars` (Task 2). **Produces:**
- `normalizeEmail(v: unknown): string | null`, `validPassword(v: unknown): v is string` in `accounts.ts`.
- Routes (all JSON): `POST /api/signup {email,password}` → 201 + cookie; 400 bad input; 409 `"That email already has an account. Sign in instead."`; 403 `"Sign-ups are closed."` when closed; 404 in self mode. Counts every attempt toward the existing per-IP limiter (export a `noteAttempt(ip)` / `blocked(ip)` pair from `auth.ts` built on the existing `failures` map) → 429 after 5 in 15 minutes.
- Cloud `POST /api/login {email,password}` → 204 + cookie or 401 `"Wrong email or password"`. Account 1 (no hash) can never sign in this way.
- `POST /api/account/password {current,next}` → 204, bumps `session_gen` and sets a fresh cookie for the caller; 401 wrong current; 400 invalid next. Cloud only (404 in self).
- `DELETE /api/account {password}` → 204; deletes `events`, `daily`, `rollups` for the account's sites, the `sites`, `account_usage`, then the `accounts` row, in one `db.batch`; `invalidateSite` for each site; clears the cookie. Cloud only.
- `/api/me` returns `Me`: `{ owner: boolean; shareSite: string | null; retentionDays: number; mode: "self" | "cloud"; email: string | null; signups: boolean; limits: { events: number; reads: number; sites: number } | null }` (`limits` null in self mode). `GET /api/config` (public) returns `{ mode: "self" | "cloud"; signups: boolean }` for the login page. `/api/signup` and `/api/config` join `PUBLIC_API`.

- [ ] **Step 1: Tests** in `accounts.test.ts`, all calls with `{ MODE: "cloud" }`: sign-up sets cookie and `/me` shows the email; `" Me@X.com "` then `"me@x.com"` → 409; short password → 400; `SIGNUPS:"closed"` → 403; self mode `/signup` → 404; 6th sign-up from one IP → 429; cloud login right/wrong; cloud login with the owner password and no email → 401; password change → old cookie 401, returned cookie 200; delete account removes its sites, events and `accounts` row, leaves another account's site intact, old cookie 401.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Report** (commit: `feat: cloud accounts — sign-up, sign-in, password, delete`).

### Task 4: Per-account limits

**Waits for:** Task 2 (and Task 1).

**Files:**
- Create: `src/worker/limits.ts`, `test/worker/limits.test.ts`
- Modify: `src/worker/ingest.ts`, `src/worker/server-events.ts`, `src/worker/public.ts`, `src/worker/api.ts` (`readGuard`, `settle`, `POST /sites`, `/usage`), `src/shared/types.ts` (`Usage` gains `scope: "account" | "install"`)

**Interfaces — Consumes:** config getters (Task 1), `accountId` on context and `siteFor` (Task 2). **Produces (`limits.ts`):**
- `accountUsage(db, accountId: number, day: string): Promise<{ events: number; rows_written: number; rows_read: number }>`
- `accountUsageStmt(db, accountId: number, day: string, events: number, rowsWritten: number, rowsRead: number): D1PreparedStatement` (upsert adding to the counters)
- `accountOverEvents(env, accountId, nowMs): Promise<boolean>` (cloud only; false in self without querying)
- `accountOverReads(env, accountId, nowMs): Promise<boolean>` (same rule)
- Ingest/server events: after `overBudget`, `if (isCloud(env) && await accountOverEvents(env, site.account_id, nowMs)) return;` and, in cloud, append `accountUsageStmt(..., rows.length, rows.length * WRITES_PER_EVENT + 1, 0)` to the existing batch.
- `readGuard(c, accountId)` also returns 429 `"This account's dashboard read limit for today is used up. It resets at 00:00 UTC."` when over; `settle(c, meter, accountId)` also records reads to the account in cloud. In share mode, `accountId` is the shared site's `account_id`. `public.ts` charges the site's account the same way.
- `POST /sites` in cloud: 403 `"This account has reached its limit of N sites."` when `COUNT(*)` ≥ `accountMaxSites`.
- `GET /usage` in cloud returns the account's numbers with `budget = accountDailyEvents`, `read_budget = accountDailyReads`, `events`, `rows_read`, `rows_written` from `account_usage`, `requests: 0`, `scope: "account"`; self returns today's install usage with `scope: "install"`.

- [ ] **Step 1: Tests** in `limits.test.ts`: self mode ingest writes no `account_usage` row; cloud ingest writes one with `events` equal to stored events; with `ACCOUNT_DAILY_EVENTS:"3"` a 5-event beacon is stored then the next beacon for that account stores nothing while a second account's site still stores; with `ACCOUNT_DAILY_READS:"1"` after one stats call the next → 429; `ACCOUNT_MAX_SITES:"1"` second `POST /sites` → 403; `/usage` shape in both modes.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Report** (commit: `feat: per-account limits in cloud mode`).

### Task 5: Cron across all accounts

**Waits for:** Task 2.

**Files:** Modify `src/worker/cron.ts`; Test `test/worker/rollup.test.ts`

**Interfaces — Consumes:** `listAllSites` (Task 2), `cronQueryBudget` (Task 1). **Produces:** `runCron(env, nowMs)` unchanged signature; uses `cronQueryBudget(env)`; site order rotated: `const start = Math.floor(nowMs / 3_600_000) % sites.length; sites = [...sites.slice(start), ...sites.slice(0, start)]` (guard `sites.length === 0`).

- [ ] **Step 1: Tests:** a site owned by account 2 gets yesterday rolled up; with `CRON_QUERY_BUDGET:"10"` and 4 sites, two consecutive runs one hour apart roll up different first sites.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Report** (commit: `feat: cron serves every account`).

### Task 6: Dashboard for cloud mode

**Waits for:** Tasks 3 and 4.

**Files:**
- Modify: `src/dashboard/pages/Login.tsx`, `src/dashboard/app.tsx`, `src/dashboard/components/Shell.tsx`
- Create: `src/dashboard/pages/Account.tsx`

**Interfaces — Consumes:** `Me`, `Usage.scope` (Tasks 3–4), routes from Task 3.
- Login reads `GET /api/config` (Task 3) for `{ mode, signups }`. Cloud: email + password fields and a link-button toggling "Create an account" / "Sign in" (posts to `/signup` or `/login`); toggle hidden when `signups` false. Self: unchanged copy and form.
- `/account` route → `Account` page inside `Shell`: shows email, today's events and reads against limits (from `/usage`), a change-password form (current, new), and a delete section: type the email to enable the button, then password; on success `location.assign("/login")`.
- Shell: in cloud mode show an "Account" link next to sign out; `UsageMeter` labels `scope:"account"` as "Today" with title text naming events and reads against the account limits.
- Use existing classes (`field`, `btn primary`, `msg error`, `head grid`, `sub`) and components; follow `impeccable-gate` for look and feel.

- [ ] **Step 1: Implement** (no worker tests; UI checked in the end UI round).
- [ ] **Step 2: Report** (commit: `feat: dashboard sign-up and account page`).

### Task 7: Docs and setup

**Waits for:** Tasks 1–6.

**Files:** `README.md`, `CHANGELOG.md`, `scripts/setup.ts`, `.dev.vars.example` if relevant.

- README: new "Hosted mode" section after "Configuration": what `MODE=cloud` does; the six new vars with defaults (table rows added to the Configuration table too); that a real hosted service needs the Workers Paid plan (raise `CRON_QUERY_BUDGET`, the D1 limits); known gaps (no email verification, no password reset, no billing); `bun run setup --cloud`. Add to Contents line.
- CHANGELOG: "Unreleased" entry listing cloud mode, and that self-hosted owners sign in once more after upgrading (session format changed) and must run migrations.
- `setup.ts`: `--cloud` flag skips the owner password prompt and `OWNER_PASSWORD_HASH`, sets `SESSION_SECRET`, prints a reminder to set `"MODE": "cloud"` in `wrangler.jsonc` and redeploy.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Report** (commit: `docs: hosted mode`).

### End of sprint (main agent)

- [ ] `bun run typecheck && bun run test && bun run build && bun run build:next` — fix failures, re-run once.
- [ ] UI round on Login (both modes) and Account page.
- [ ] `/code-review` on the branch diff.
