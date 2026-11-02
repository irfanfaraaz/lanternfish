# Changelog

## Unreleased

### Added

- Hosted mode (`MODE=cloud`): sign-up with email and password, per-account isolation, per-account daily limits on events and dashboard reads, a cap on sites per account, and an Account page to change the password or delete the account. See the README's "Hosted mode".
- `CRON_QUERY_BUDGET` sets how many D1 queries the hourly job may use; the job now serves every account's sites and rotates which sites go first.
- `bun run setup --cloud`.

### Changed

- Sessions now name their account. Self-hosted owners sign in once more after upgrading. Run `bunx wrangler d1 migrations apply lanternfish --remote` (migration `0002_accounts.sql`).

## 2026-10-17

### Added

- `lanternfish-next` 0.1.0 on npm: `<Lanternfish />`, a one-line proxy route and a two-line `proxy.ts` for AI-agent logging.
- Light, dark and system themes, switched from the lantern in the top band.
- The dashboard scales up on screens 1600px and wider.

### Changed

- Settings leads with the one-line install; optional steps fold away.
- Web Vitals ratings carry a shape as well as a colour, with a key.
- The usage meter turns amber at 60% of the daily budget, red at 80%.

### Fixed

- Text rendered about 6% smaller than designed.
- Phone layout: top band, site switcher, chart labels, Web Vitals units, unlabelled Sites figures.
- The saved timezone didn't show in the Settings dropdown after reload.
- README: free D1 storage is 500 MB per database, not 5 GB.

## 2026-10-16

### Added

- Lanternfish v1: cookieless analytics on Cloudflare Workers and D1, with section funnels, custom events, outbound links, AI-agent logging, Core Web Vitals, 404s, share links, public stats and CSV export.
