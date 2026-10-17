# Lanternfish

Cookieless web analytics you host yourself on Cloudflare's free tier. One dashboard for any number of sites.

A lanternfish is a deep-sea fish that makes its own light.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/irfanfaraaz/lanternfish)

## What it tells you

- How many people visit each site, from which country, and through which link (`?ref=` and `utm_source` tags included).
- How far down a page they get, section by section, as a funnel.
- What they click: outbound links, contact buttons, any element you tag.
- Which AI agents and crawlers fetch your pages (GPTBot, ClaudeBot, PerplexityBot and others), logged from your server because bots don't run JavaScript.
- Core Web Vitals (LCP, INP, CLS) per page, and 404s.

## Privacy

- **No cookies** on tracked sites and no consent banner needed. The only cookie is the dashboard's own sign-in.
- **No stored IP addresses.** A visitor is the first 16 hex characters of `SHA-256(daily salt + site + IP + user agent)`. The salt is random each UTC day and deleted after 48 hours, so a hash can't be reversed or linked across days or sites.
- **Global Privacy Control** is honoured: browsers that send it send nothing.
- Automated browsers (`navigator.webdriver`) send nothing.
- Visit any tracked page with `?lf=off` to stop counting your own visits in that browser; `?lf=on` resumes.

## How it works

One Cloudflare Worker does everything:

| Route | Purpose |
|---|---|
| `GET /lf.js` | the tracker, under 2 KB gzipped, cached for a day |
| `POST /e` | browser events, sent directly or through your site's proxy |
| `POST /s` | signed server events, such as agent fetches |
| `/api/*` | the dashboard's API (owner sign-in or a share link) |
| `GET /p/:site` | public 30-day totals for sites that opt in |
| `/*` | the dashboard |
| cron, hourly at :10 | daily rollups per site timezone, pruning, salt rotation |

Data lives in D1. Raw events are kept for 90 days (`RETENTION_DAYS`), and daily rollups are kept forever.

## Deploy

You need a Cloudflare account (the free plan is enough, no card) and [Bun](https://bun.sh).

```sh
git clone https://github.com/irfanfaraaz/lanternfish
cd lanternfish
bun install
bunx wrangler login
bun run setup
```

`setup` builds and deploys the Worker, which creates the D1 database. It then applies the migrations, asks for an owner password and stores the password hash and a session secret as Worker secrets. Open the URL it prints and sign in.

The "Deploy to Cloudflare" button does the deploy part from the browser. Afterwards, run `bun run setup` locally once to set your password.

To use your own domain, add a custom domain to the Worker in the Cloudflare dashboard (the domain's DNS must be on Cloudflare), or keep the `workers.dev` address.

### Upgrading

```sh
git pull
bun install
bun run deploy
bunx wrangler d1 migrations apply lanternfish --remote
```

Migrations are numbered SQL files in `migrations/` and only ever add to the schema.

## Add a site

In the dashboard choose **Add site**, enter its name and domains, and paste the script tag into every page's `<head>`:

```html
<script defer src="https://lanternfish.<you>.workers.dev/lf.js" data-site="abc123"></script>
```

Events from any domain not listed for the site are dropped. Use `*.example.com` to allow every subdomain.

### Tracking attributes

No JavaScript needed for any of these:

| Attribute | Effect |
|---|---|
| `data-lf-section="hero"` | counted once per page load when half of it, or half the screen, is visible; list section names in order under Settings to see a funnel |
| `data-lf-click="contact"` | sends a `contact` event on click |
| `data-lf-prop-method="email"` | adds `method: "email"` to that click event (up to 5 props) |
| `<html data-lf-404>` | marks the page as a 404 |

From code: `lf("signup", { plan: "pro" })`. Calls made before the script loads are queued if you define `window.lf = window.lf || function () { (lf.q = lf.q || []).push(arguments) }` first.

Page views, time on page, outbound links and Web Vitals are automatic. Client-side navigation (History API) is followed.

Event names use lowercase letters, digits, `_` and `:`, up to 40 characters. Each event takes up to 5 props, with string values of up to 100 characters, or numbers.

## Proxy through your own domain

Some ad blockers drop requests to a third-party analytics host. To send events through your own domain instead, serve `/api/e` on your site and forward it to the Worker with signed headers. The dashboard's Settings page shows each snippet with your site's values filled in.

**Next.js:** copy `snippets/nextjs/lib/lanternfish.ts` and `snippets/nextjs/app/api/e/route.ts`, set `LF_ORIGIN`, `LF_SITE` and `LF_SERVER_KEY`, and add `data-api="/api/e"` to the script tag.

**Any backend:** forward the body unchanged to `<worker>/e` with these headers, and answer the browser with `204`:

| Header | Value |
|---|---|
| `x-lf-ts` | current Unix time in seconds |
| `x-lf-origin` | the browser's `Origin` |
| `x-lf-ip` | the visitor's IP (used in memory only) |
| `x-lf-ua` | the visitor's `User-Agent` |
| `x-lf-country`, `x-lf-city` | optional |
| `x-lf-sig` | hex HMAC-SHA256 of `ts\norigin\nip\nua`, keyed with the site's server key |

Signatures older than five minutes are rejected.

## AI agents and crawlers

Bots don't run the tracker, so log them from your server.

**Next.js:** copy `snippets/nextjs/proxy.ts` (Next 16's middleware). Its matcher only fires for known bot user agents, and `after()` sends the event once the response is on its way. Without a proxy, add the one line from `snippets/nextjs/route-handler.ts` to individual route handlers such as `llms.txt`. Don't use both, or each fetch counts twice.

**Anything else:**

```sh
curl -X POST https://lanternfish.<you>.workers.dev/s \
  -H "x-lf-key: $LF_SERVER_KEY" \
  -H "content-type: application/json" \
  -d '{"site":"abc123","name":"agent","path":"/llms.txt","ua":"<the request User-Agent>"}'
```

If `props.bot` is missing, the Worker works out the bot from `ua`. The known list is in `src/shared/bots.ts`.

## Free-tier budget

All your sites share one Cloudflare account's limits. A typical visit sends about 12 events in about 3 requests.

| Free limit (approximate) | Visits a day it supports, all sites combined |
|---|---|
| Workers: 100,000 requests a day | about 30,000 |
| D1: 100,000 rows written a day | about 1,800 with 90-day retention; about 3,500 with `RETENTION_DAYS=0` |
| D1: 5,000,000 rows read a day | dashboard use, not visits: rollups keep each view to a few thousand rows |
| D1: 500 MB per database (5 GB per account) | about 90 days of raw events at the write limit, so 90-day retention sits near the cap; with `RETENTION_DAYS=0` it fills in about 45 days. Lower `RETENTION_DAYS` if usage gets close |

D1 counts each indexed insert as 2 rows written, and deleting old events costs the same again, so writes are the real ceiling. Lanternfish stops storing events once `DAILY_WRITE_BUDGET` (default 95,000) is reached and starts again at 00:00 UTC. Tracked sites keep working, and the dashboard header shows today's usage.

Reads are shared between ingest and the dashboard. Once the dashboard has read `DAILY_READ_BUDGET` rows (default 4,000,000) it pauses until 00:00 UTC, so tracking never runs out of reads. Realtime polls every 30 seconds, and public stats are cached at the edge for five minutes.

## Configuration

Everything is set through Worker variables and secrets. Nothing personal is in the code.

| Name | Kind | Default |
|---|---|---|
| `OWNER_PASSWORD_HASH` | secret | set by `bun run setup` (or `echo -n 'pw' \| bun run hash-password`) |
| `SESSION_SECRET` | secret | set by `bun run setup` |
| `RETENTION_DAYS` | var | `90` (`0` keeps raw events forever) |
| `DAILY_WRITE_BUDGET` | var | `95000` |
| `DAILY_READ_BUDGET` | var | `4000000` |

The owner password is hashed with PBKDF2-SHA256 at 10,000 iterations. The free plan gives a Worker 10 ms of CPU per request, and 100,000 iterations take about 50 ms. Logins are rate-limited, and the hash only exists as a Worker secret.

CSV exports are capped at 400,000 rows per download (the free plan allows 50 database queries per request). Export a shorter range for more.

## Development

```sh
cp .dev.vars.example .dev.vars   # then fill in a password hash
bunx wrangler d1 migrations apply lanternfish --local
bun run build && bun run dev     # Worker and dashboard on :8787
bun run test                     # Worker tests in the Workers runtime
bun run typecheck
```

## Licence

[AGPL-3.0](LICENSE). You may self-host and change Lanternfish. If you run a modified copy as a service for others, you must publish your changes.
