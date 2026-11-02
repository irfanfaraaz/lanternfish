# Multi-user cloud mode — design

Status: approved for build (owner asked for every open question to be settled with the recommended option while they were away; all such choices are marked **[call]**).

## Intent

Lanternfish today is self-hosted analytics for one person: one owner password, one account (`ACCOUNT_ID = 1` hard-coded), one shared daily D1 budget. The owner wants to find out whether it can become a hosted service that anyone can sign up for and use, without losing the self-hosted version that the README, the Deploy button and existing installs depend on.

Success: one Worker deployment, switched to cloud mode, lets many people create accounts with email and password, add their own sites, see only their own data, and stay inside per-account limits so one busy account cannot stop everyone else's tracking. A self-hosted deployment that never touches the new settings behaves exactly as it does today.

## Goals

1. **Two modes, one codebase.** A Worker var `MODE`: `"self"` (default) or `"cloud"`. **[call]** keeping self-hosting as the default protects existing installs and the Deploy button.
2. **Accounts in cloud mode.** Sign up and sign in with email + password; sign out; change password; delete account (with all its sites and data).
3. **Isolation.** Every dashboard API call is scoped to the signed-in account. An account can never read, change or delete another account's sites, stats, exports, keys or share links. Share links keep working for the one site they grant.
4. **Per-account limits (cloud mode).** Daily events stored, daily dashboard rows read, and number of sites, each set by a Worker var. The existing whole-install budgets stay as an outer guard.
5. **The cron serves every account's sites**, not only account 1.
6. **Dashboard** shows sign-up in cloud mode, an Account page, and the account's own usage instead of the install-wide D1 meter.
7. **Docs** explain how to run Lanternfish as a hosted service.

## Non-goals (this version)

- Email verification, password reset, magic links (all need an email provider). **[call]** deferred; the operator can close sign-ups with `SIGNUPS=closed`, and a forgotten password is handled by the operator for now.
- Billing, plans, payments.
- An admin panel (the operator uses `wrangler d1 execute`).
- Teams or several people per account.
- Moving raw events off D1 or sharding databases.
- Bot protection on sign-up beyond an IP rate limit (Turnstile is a later step).

## Anti-goals (would be a failure even if it works)

- Any change in behaviour, cost or setup for a self-hosted install that leaves `MODE` unset. In particular self mode must not add D1 writes per event.
- Any path where one account's session, share link or server key reaches another account's data.
- Storing anything new about visitors. Privacy guarantees in the README stay true word for word.

## Constraints

- Cloudflare Workers + D1 + Hono + Preact, as today. No new runtime dependencies. **[call]**
- Free plan gives 10 ms CPU per request: password hashing stays PBKDF2-SHA256 at the existing iteration count with the count stored in the hash, so it can be raised later.
- Migrations only add to the schema (`migrations/0002_*.sql`).
- Tests run in `@cloudflare/vitest-plugin`; existing tests must keep passing in self mode.

## Decisions on the how

### Mode and config

New Worker vars (strings, like the existing ones):

| Var | Default | Meaning |
|---|---|---|
| `MODE` | `self` | `cloud` turns on accounts and per-account limits |
| `SIGNUPS` | `open` | `closed` refuses new sign-ups (cloud mode) |
| `ACCOUNT_DAILY_EVENTS` | `10000` | events stored per account per UTC day (cloud) |
| `ACCOUNT_DAILY_READS` | `500000` | dashboard rows read per account per UTC day (cloud) |
| `ACCOUNT_MAX_SITES` | `10` | sites per account (cloud) |
| `CRON_QUERY_BUDGET` | `40` | D1 queries one cron run may use (raise to ~900 on the paid plan) |

A non-positive or unparsable limit falls back to its default. **[call]** defaults sized so ten accounts at the cap fit the free write budget, roughly.

### Schema (migration 0002)

- `accounts` gains `password_hash TEXT` and `session_gen INTEGER NOT NULL DEFAULT 0`. Emails are stored lower-cased and trimmed; the existing `UNIQUE` on `email` enforces one account per email. Account 1 (email NULL) stays as the self-hosted owner.
- New `account_usage (account_id INTEGER, day TEXT, events INTEGER DEFAULT 0, rows_written INTEGER DEFAULT 0, rows_read INTEGER DEFAULT 0, PRIMARY KEY (account_id, day))`.
- New index `sites_account ON sites (account_id)`.
- Deleting an account deletes its sites' `events`, `daily`, `rollups`, its `sites`, its `account_usage` rows, then the `accounts` row.

### Sessions and auth

- Session token becomes `${accountId}.${gen}.${exp}.${sig}` with `sig = HMAC(SESSION_SECRET, "session:" + accountId + ":" + gen + ":" + exp)`. Old v1 tokens (`exp.sig`) are rejected, so self-hosted owners sign in once more after upgrading. **[call]** simpler than carrying two formats; one extra sign-in is cheap.
- `authenticate` looks up the account row (one D1 read) and checks `session_gen` matches; changing password or deleting the account bumps/removes it, which signs out every device.
- Context vars become `{ accountId: number | null; shareSite: string | null }`. `owner` (boolean) is kept as `accountId !== null` so existing route code reads the same.
- Self mode: `POST /api/login` takes `{ password }` and checks `OWNER_PASSWORD_HASH` as today, issuing a session for account 1.
- Cloud mode: `POST /api/login` takes `{ email, password }` and checks `accounts.password_hash`. `POST /api/signup` takes `{ email, password }` (password 12–200 chars, email ≤ 254 chars and a simple `x@y.z` shape), creates the account, signs in. Duplicate email → 409 with a plain message. Sign-up attempts share the login failure limiter (5 per IP per 15 minutes counts failures; sign-ups count every attempt). `SIGNUPS=closed` → 403.
- In cloud mode `OWNER_PASSWORD_HASH` is ignored; account 1 cannot sign in (it has no email or password hash).
- `POST /api/account/password` `{ current, next }` and `DELETE /api/account` `{ password }` (cloud only; both re-check the password). `GET /api/me` adds `mode`, `email`, `signups` (open/closed) and the account's limits.

### Isolation

- Every use of `ACCOUNT_ID` in `api.ts` is replaced by the request's `accountId`. `ownedSite(db, id, accountId)`; share mode passes the share-granted site id and loads it by id only after `authenticate` has already matched it.
- `updateSiteStmt` already filters on `account_id`; deletes in `api.ts` must also filter by account (they run after `ownedSite`, but add the guard in SQL as well).
- Tests prove cross-account access gets 404 on every `/api/sites/:id*` route.

### Per-account limits

- In cloud mode, ingest (`/e`) and server events (`/s`) add one upsert to `account_usage` in the same D1 batch as the insert, and refuse to store once the account's `events` for today reaches `ACCOUNT_DAILY_EVENTS`. The install-wide `DAILY_WRITE_BUDGET` check stays. Self mode does neither extra read nor extra write.
- Dashboard reads: `readGuard` also checks the account's `rows_read` against `ACCOUNT_DAILY_READS` in cloud mode, and `settle` records reads to the account as well. 429 message names the per-account limit.
- `POST /api/sites` refuses with 403 when the account already has `ACCOUNT_MAX_SITES` sites (cloud mode).
- `GET /api/usage` in cloud mode returns the account's own numbers against its limits (same `Usage` shape plus `scope: "account" | "install"`).
- Public stats (`/p/:site`) and share-link views are charged to the site's account, since a share viewer has no account of their own. **[call]**
- Deleting an account invalidates each of its sites in the per-isolate site cache, so ingest stops at once in that isolate (others drop it within the cache's one-minute TTL).

### Cron

- Lists every site (`listAllSites`), not account 1's.
- Query budget from `CRON_QUERY_BUDGET`.
- Sites are visited starting at an offset that moves each hour (`hour % sites.length`), so when the budget can't cover all sites, different sites are pruned and rolled up first each run and none starve. **[call]**

### Dashboard

- `/me` drives the UI. Login page: in self mode unchanged; in cloud mode email + password with a "Create an account" switch (hidden when sign-ups are closed).
- New `/account` page (cloud mode only): email, usage against limits, change password, delete account (type the email to confirm, then password).
- Shell: the usage meter shows the account's events and reads against its limits in cloud mode; adds an "Account" link in cloud mode.
- Uses the existing components and styles (`ui.tsx`, `base.css`); no new visual language.

### Docs and setup

- README: a "Hosted mode" section (what it does, vars, the paid-plan note, what is not built yet); config table rows for the new vars; CHANGELOG entry.
- `bun run setup --cloud` sets only `SESSION_SECRET` and reminds the operator to set `MODE=cloud` in `wrangler.jsonc`.

## Left to the builder

Exact file split (a new `src/worker/accounts.ts` is suggested), test layout, the wording of messages (plain, like the existing ones), and the Account page layout within the existing design.

## Risks

- D1 free limits cap a hosted install at a few thousand visits a day across all accounts; the README must say a real hosted service needs the paid plan.
- In-memory login limiter is per isolate, as today: a soft guard only.
- No password reset: documented as a known gap.
