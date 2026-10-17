# Changelog

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
