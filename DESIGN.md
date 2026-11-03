---
name: Lanternfish
description: Cookieless analytics dashboard kept like a field notebook, on parchment in navy ink.
colors:
  parchment: "#f5f4ed"
  paper: "#fbfaf5"
  ink: "#1a2030"
  ink-soft: "#5b6070"
  carrier-navy: "#1f3d7a"
  on-navy: "#ffffff"
  fog: "#e9e7dd"
  muted-paper: "#ebe9e0"
  danger-red: "#b02616"
  on-danger: "#ffffff"
  good-green: "#17663a"
  wait-amber: "#8c4d08"
  rule: "#dcd9cd"
  field-rule: "#85816f"
  chart-violet: "#6b55b8"
  parchment-dark: "#15171c"
  paper-dark: "#1c1f26"
  ink-dark: "#eeede6"
  ink-soft-dark: "#a4a8b1"
  carrier-navy-dark: "#8aa8e6"
  on-navy-dark: "#0a1530"
  fog-dark: "#262a33"
  danger-red-dark: "#f0786b"
  on-danger-dark: "#1a0705"
  good-green-dark: "#5fcf8a"
  wait-amber-dark: "#f2b54a"
  rule-dark: "#2f343e"
  field-rule-dark: "#6b7381"
  chart-violet-dark: "#a996e8"
typography:
  display:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "clamp(3.5rem, 8vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  band:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  wordmark:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
  figure:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  figure-inline:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "\"tnum\""
  figure-live:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "clamp(3.5rem, 8vw, 5.5rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  stamp:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  stamp: "2px"
  sm: "4.8px"
  md: "6.4px"
  base: "8px"
  pill: "999px"
  sketch-btn: "225px 12px 255px 12px / 12px 255px 12px 225px"
  sketch-card: "40px 10px 36px 10px / 10px 36px 10px 40px"
  sketch-panel: "28px 8px 24px 8px / 8px 24px 8px 28px"
  sketch-stat: "255px 14px 225px 14px / 14px 225px 14px 255px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  card-pad: "20px"
  card-pad-sm: "12px"
  page-x: "40px"
  page-y: "36px"
  section-gap: "32px"
  gutter: "24px"
  target: "40px"
  target-touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.carrier-navy}"
    textColor: "{colors.on-navy}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sketch-btn}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.fog}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sketch-btn}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.muted-paper}"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.danger-red}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-danger-solid:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.on-danger}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sketch-btn}"
    padding: "0 16px"
    height: "40px"
  segment:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  segment-pressed:
    backgroundColor: "{colors.carrier-navy}"
    textColor: "{colors.on-navy}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sketch-card}"
    padding: "{spacing.card-pad}"
  stat-tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.sketch-stat}"
    padding: "{spacing.card-pad}"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sketch-panel}"
    padding: "{spacing.card-pad}"
  chip:
    backgroundColor: "{colors.fog}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.base}"
    padding: "0 2px 0 12px"
    height: "36px"
  stamp-good:
    textColor: "{colors.good-green}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "2px 6px 1px"
  stamp-wait:
    textColor: "{colors.wait-amber}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "2px 6px 1px"
  stamp-bad:
    textColor: "{colors.danger-red}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "2px 6px 1px"
  tab-active:
    textColor: "{colors.carrier-navy}"
    typography: "{typography.body}"
    height: "40px"
---

# Design System: Lanternfish

## Overview

**Creative North Star: "The Field Notebook"**

Lanternfish is kept like a naturalist's notebook: a parchment ground, slightly lighter paper cards drawn by hand with a 2px ink line, ink text, and one Carrier Navy ink for anything you can act on. Titles are set in a book serif, every number is set in a mono, and a status is a rubber stamp. It is the look of Mailrust Field Notes, adapted for an analytics dashboard: same materials, Lanternfish's own wordmark, no sidebar.

It is an Operate surface. The notebook character lives in materials (the uneven card edge, the hard ink-offset shadow, the stamp) and never in the way of reading numbers. Density is moderate: the overview reads as a page header, four stat tiles, the chart, then three chapters (Traffic, Audience, Behaviour and health).

It replaces the earlier "Swiss timetable" look (black band, one red, square corners, a sans everywhere). That look is the anti-reference: no black band, no red as decoration, no ruled column grid.

**Key Characteristics:**

- Parchment page, paper cards with a 2px ink sketch border and uneven corners, a hard offset shadow, never a blurred one.
- Carrier Navy is the only action colour: primary buttons, links, focus, the selected tab, the views series, share bars, native controls.
- Red, amber and green mean danger, waiting and done. They never decorate.
- Source Serif 4 for titles and the wordmark, Geist for prose and controls, Geist Mono for every number and every stamp.
- Light and dark themes, both verified at WCAG AA, switched by the lantern in the top bar (system, light, dark).

## Colors

A warm, low-chroma parchment and ink pair with one deep navy. Dark mode lifts navy to a pale periwinkle and paper to a dark slate; it is composed, not inverted. Each token is a `light-dark()` pair in `src/dashboard/styles/tokens.css`; the `-dark` keys above are the dark halves.

### Primary

- **Carrier Navy** (`carrier-navy` / `carrier-navy-dark`): primary buttons, links, the focus ring (drawn at full strength, 2px with a 2px offset), the active tab and its underline, the pressed range segment, the views series and its 10% area wash, bar-list share bars, the funnel fill, checkboxes (`accent-color`), the caret and text selection. Text on it is `on-navy` (10.46:1 light, 7.59:1 dark).

### Secondary

- **Chart Violet** (`chart-violet`): reserved fourth chart series. Not used on a current screen.

### Neutral

- **Parchment** (`parchment`): the page ground and the top bar.
- **Paper** (`paper`): every card, tile, panel, input, the quiet button and the stamp's ground.
- **Ink** (`ink`): text, the 2px sketch border on every card and the primary/secondary button, the visitors series, the chart baseline. 14.7:1 on parchment.
- **Ink Soft** (`ink-soft`): labels, meta, hints, axis text, the previous-period dashed line, placeholders. 5.68:1 on parchment light, 7.53:1 dark.
- **Fog** (`fog`) and **Muted Paper** (`muted-paper`): the secondary button fill, chips, hover fills on rows and controls, code wells and key boxes.
- **Rule** (`rule`): dashed dividers and grid lines only. Below 3:1 on purpose; it never carries meaning.
- **Field Rule** (`field-rule`): 1.5px input and quiet-button borders, kbd keys. 3.74:1 on paper light, 3.45:1 dark.

### Meaning

- **Good Green** (`good-green`): a better delta, Good vitals, the Counting stamp, a confirmation slip's tick.
- **Wait Amber** (`wait-amber`): Needs work vitals, the Busy budget stamp (from 60%), the Listening stamp.
- **Danger Red** (`danger-red`): a worse delta, Poor vitals, errors, destructive outlines, the filled delete buttons (with `on-danger`), the Near limit stamp (from 80%).

### Contrast fixes against Field Notes as shipped

| Pair | Shipped | Lanternfish value | Now |
|---|---|---|---|
| Input border on paper | #c8c5b8 / #3a404b (1.66 / 1.58) | #85816f / #6b7381 | 3.74 / 3.45 |
| Focus ring on parchment | primary at 50% (2.61 / 2.84) | primary at 100% | 9.49 / 7.53 |
| Good on muted (light) | #1d7a43 (4.32 on fog) | #17663a | 5.76 muted, 6.70 paper |
| Wait on muted (light) | #a35a0a (4.21 on fog) | #8c4d08 | 5.43 muted, 6.32 paper |
| Destructive on fog (light) | #c42b1c (4.57) | #b02616 | 5.40 fog, 6.41 paper |
| Text on filled danger (dark) | white on #f0786b (2.76) | #1a0705 on #f0786b | 7.06 |

**The One Ink Rule.** Navy is the only colour that means "you can act here" or "this is selected". If a new element wants navy and is not an action, selection or the primary series, it is wrong.

**The Meaning Rule.** Red, amber and green appear only when something is bad, waiting or good. A status that is merely a label (Live, Next step, an expiry) is a navy or ink stamp.

## Typography

**Title Font:** Source Serif 4 (Google Fonts, `opsz,wght@8..60,600`, `display=swap`), falling back to Georgia.
**Body Font:** Geist Variable (bundled via @fontsource-variable).
**Number Font:** Geist Mono Variable (bundled), tabular figures.

Three families, each with one job. The serif gives the notebook voice to titles only; the sans carries prose and controls at a dense 14px; the mono makes numbers line up and read as measurements.

### Hierarchy

- **Display** (600, `clamp(3.5rem, 8vw, 6rem)`, 0.95): the sign-in "Lantern / fish." mark only. Its full stop is navy.
- **Heading** (600, 1.875rem, 1.25): page titles (site name, Sites, Account).
- **Band** (600, 1.5rem): the overview's chapter headings, followed by a dashed rule to the edge.
- **Wordmark** (600, 1.375rem): "Lanternfish" in the top bar; 1.25rem on phones.
- **Title** (600, 1.125rem): card titles, the Right now card, About these numbers. Snippet and disclosure titles step down to 1rem.
- **Body** (400, 0.875rem, 1.5): everything else. Prose is capped at 65ch and wraps `pretty`; headings wrap `balance`.
- **Label** (500, 0.6875rem, UPPERCASE, +0.08em): field labels, card meta, table headers, tile captions, the budget label.
- **Figure** (mono 600, 1.875rem; 1.5rem on phones): stat tiles. **Figure inline** (mono 600, 1.25rem): site-row totals, account ledger. **Figure live** (mono 600, fluid): the realtime count.
- **Stamp** (mono 700, 0.6875rem, UPPERCASE, +0.08em).

**The Ledger Rule.** A number is always set in Geist Mono: tiles, bar values and percentages, tables, axis ticks, the chart readout, deltas, funnel counts, dates in date fields, the budget percentage. A title is never set in the sans.

## Layout

A single top bar (parchment, 2px ink rule beneath) holds the wordmark, the site switcher, the site tabs (Overview, Realtime, Settings), the daily budget, the lantern theme switch and Account / Sign out. No sidebar: three tabs do not earn one.

Content sits in a 1440px column padded `page-x` × `page-y` (40 × 36px; 16 × 24px below 760px), on a 12-column grid with 24px gutters (4 columns and 16px below 760px). Sections sit `section-gap` (32px) apart; overview chapters get an extra 12px above.

- **Page head:** serif title and one context line on the left, actions on the right (they wrap under on phones).
- **Overview:** filter chips, four stat tiles (two per row on phones), the chart panel, then chapters: Traffic (pages, referrers, link tags, countries), Audience (devices, browsers, OS in thirds), Behaviour and health (sections funnel full width, events, outbound, vitals, 404s, AI agents full width, capped at 8 rows with Show all). A footer holds About these numbers (65ch) and the keyboard hint.
- **Range picker:** four presets plus Custom; the two date fields appear only for Custom. Keys 1 to 4 pick a preset.
- **Settings:** a sticky section index on the left (200px) and one stacked column of cards (max 920px): Install, Site, Keys and sharing, Data, Delete site. Below 1080px the index becomes a row of pill links. After Add site, Install leads with a "Listening for the first visit" line.
- **Realtime:** a Right now card (5/12) with the count, a Live stamp, "Updated Ns ago" and a trail of the readings taken while the tab is open; Active pages (7/12) beside it.
- **Tap targets:** 40px with a fine pointer, 44px below 760px, including bar-list rows, segments, chips' remove buttons and the theme switch.

## Elevation & Depth

Depth is drawn, not lit. Sketch surfaces carry a hard ink offset with no blur; nothing else has a shadow.

### Shadow Vocabulary

- **Card** (`3px 4px 0` ink at 16% light, black at 45% dark): every card, tile, panel and site row.
- **Button** (`2px 2px 0`): the primary button, the filled danger button and the confirmation slip.
- **Lift** (`5px 7px 0`): a hovered site row (with `rotate(-0.6deg)`) and a hovered primary button (with a 1px nudge up-left). Pressing a primary button drops the shadow and moves it 2px into the page.

**The Drawn Depth Rule.** A shadow is always a hard offset on a sketch surface. Never a blurred drop shadow, never on a flat control.

## Shapes

- **Sketch corners** on everything that is a surface: `sketch-card` for cards and site rows, `sketch-panel` (calmer) for the chart panel, `sketch-stat` (full wobble) for stat tiles, `sketch-btn` for primary, secondary and filled danger buttons. Always with the 2px ink border.
- **Soft corners** elsewhere: inputs, quiet and outline-danger buttons, key boxes and code wells at 6.4px; segments 4.8px inside an 8px frame; chips 8px; stamps 2px; the budget meter a pill.
- Icons are authored 16px line icons at 1.5 stroke with round caps, in the text colour. Empty states use hand-drawn doodles (a lantern, a fish) in 2px ink strokes with one navy accent stroke.

## Components

### Buttons

- **Primary** (navy, ink sketch border, button shadow): one per view: Add site, Save changes, Sign in, Create account, Change password.
- **Secondary** (fog fill, ink sketch border): Create link, Download CSV.
- **Quiet** (paper, 1.5px field-rule border, soft corners): Copy, Reveal, Cancel. Copy turns green with a tick and reads "Copied".
- **Danger outline** (paper, danger border and text): the first press of Rotate key, Revoke all links, Delete data. **Danger solid** (danger fill, sketch border): the confirming press, Delete site, Delete account.
- Disabled and busy: 55% opacity, no shadow, no pointer.

### Inline confirmation

No native `confirm()` or `prompt()`. A destructive action arms on first press and opens a dashed danger box that says exactly what goes ("Every raw event and daily total for Field journal recorded before Sun, 2 Nov 2025 goes"), with the solid danger button and Cancel. Escape disarms. Deleting a site or an account is type-to-confirm with an inline error when the text does not match.

### Cards / Containers

Section cards hold a serif title with optional label-style meta on the right. Cards in a row share a height. Cards never nest; inside a card, structure comes from dashed rules and spacing.

### Stat tiles

Label caption, mono figure that rolls like an odometer, mono delta coloured by meaning (bounce rate counts lower as better).

### Bar lists

Every row with a filter is one 40/44px button: name, mono value, mono share, a navy share bar under it (scaled with `transform`), and a funnel mark that appears on hover and focus (faintly visible on touch screens). Hover fills the row with muted paper. The row's accessible name says "Filter by …".

### Stamps and slips

Stamps are mono uppercase words in a 1.5px border with a 7% tint of their own colour, rotated -1.5deg: Good / Needs work / Poor, Live, Next step, Listening / Counting, Busy / Near limit, a share link's expiry. A slip is a paper chip with a tick that confirms in the past tense: Saved, Password changed, Deleted data before ….

### Inputs / Fields

Paper fill, 1.5px field-rule border, 6.4px corners, ink on hover, navy on focus plus the navy ring. Labels use the label style; hints are ink-soft; invalid fields turn the border danger red with an error hint. Placeholders use ink soft.

### Navigation

Top-bar tabs are ink-soft text; the current tab is navy with a 2px navy underline sitting on the bar's ink rule. A skip link ("Skip to content") is the first tab stop. `g` then `o`, `r` or `s` switches tabs.

### Chart

Views in navy (2.25px) with a 10% navy wash, visitors in ink (1.5px), the previous period dashed in ink soft. Y-axis labels sit in a 40px left gutter so no series runs under them; grid lines are dotted rule. Hover or arrow keys move a dashed hairline and a paper dot ringed in navy; the readout above shows the values in mono.

### Signature moment: the inked chart

The first time the chart has data, the views line is drawn left to right like a pen stroke over 900ms, with a small paper nib riding the tip (one requestAnimationFrame loop moves the stroke and the nib together, then stops). The visitors line follows 260ms later, the wash and the previous period settle in. It runs once per visit to the page and only with `prefers-reduced-motion: no-preference`.

### Motion

All motion lives inside `prefers-reduced-motion: no-preference`; with reduced motion the page is complete and still (reels on their digits, bars at length, cards in place). Cards rise in (420ms, `cubic-bezier(.22,1,.36,1)`, stagger capped at 160ms). Stamps land with a thunk and slips tilt in (`cubic-bezier(.34,1.56,.64,1)`, the one deliberate spring). Figures and the realtime count roll like an odometer. Share bars grow with `scaleX`. Feedback transitions are 150ms. The live dot's pulse and skeletons are the only loops.

## Do's and Don'ts

### Do:

- **Do** give each view one navy primary button.
- **Do** set every number in Geist Mono and every title in Source Serif 4.
- **Do** draw edges that carry meaning with the 2px ink sketch border; use the rule colour only for dashed dividers.
- **Do** say what a destructive action will remove, inline, before it happens.
- **Do** check new text pairs at 4.5:1 (3:1 for borders, focus and 24px+ text) in both themes.
- **Do** keep every animation inside `prefers-reduced-motion: no-preference` and move it with `transform` or `opacity`.

### Don't:

- **Don't** use red, amber or green for decoration, branding or emphasis.
- **Don't** use a blurred shadow, or a shadow on anything that is not a sketch surface.
- **Don't** bring back the Swiss timetable: no black band, no ruled column grid, no square-cornered red buttons.
- **Don't** nest cards, or put a native `confirm()` / `prompt()` in front of a destructive action.
- **Don't** use emoji, or a Mailrust name, tab colour or sidebar in Lanternfish.
- **Don't** animate `width` or `height` for bars and meters.
