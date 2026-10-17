# Contributing

Thanks for helping. Lanternfish is small on purpose, so the bar for new features is whether they fit Cloudflare's free tier and keep the privacy promises in the README.

## Set up

You need [Bun](https://bun.sh).

```sh
git clone https://github.com/irfanfaraaz/lanternfish
cd lanternfish
bun install
cp .dev.vars.example .dev.vars          # then: echo -n 'a-test-password' | bun run hash-password
bunx wrangler d1 migrations apply lanternfish --local
bun run build && bun run dev            # Worker and dashboard on http://localhost:8787
```

## Before you open a pull request

```sh
bun run typecheck
bun run test          # Worker tests run in the Workers runtime
bun run build         # also checks the tracker stays under 2 KB gzipped
bun run build:next    # if you touched packages/next or snippets/nextjs
```

CI runs the same commands.

## Ground rules

- **Free tier first.** D1 writes are the real ceiling (100,000 rows a day). Every index adds a write per event, so don't add one without measuring. Count queries per request too: the free plan allows 50.
- **No personal data.** No cookies on tracked sites, no stored IP addresses, no cross-day identifiers. Global Privacy Control and `navigator.webdriver` stop the tracker entirely.
- **The tracker stays tiny.** `src/tracker/lf.ts` must build to 2,048 bytes gzipped or less.
- **Migrations only add.** New numbered SQL files in `migrations/`; never edit an applied one.
- **Design.** The dashboard follows [DESIGN.md](DESIGN.md): one red accent, square corners, hairlines, no shadows.

## Layout

| Path | What |
|---|---|
| `src/worker/` | the Cloudflare Worker: ingest, API, rollups, cron |
| `src/dashboard/` | the Preact dashboard |
| `src/tracker/` | `lf.js`, the browser tracker |
| `src/shared/` | types and helpers used by more than one of the above |
| `packages/next/` | the `lanternfish-next` npm package |
| `snippets/nextjs/` | copy-paste Next.js files (also bundled into the package) |
| `migrations/` | D1 schema |
| `test/worker/` | tests |

## Licence

By contributing you agree your work is released under the [AGPL-3.0](LICENSE).
