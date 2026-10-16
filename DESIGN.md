---
name: Lanternfish
description: Cookieless analytics dashboard set like a Swiss timetable.
colors:
  paper: "#f5f5f2"
  paper-2: "#ebebe6"
  ink: "#111110"
  ink-2: "#4a4a46"
  ink-3: "#6e6e68"
  rule: "#d4d4cd"
  rule-strong: "#111110"
  grid: "rgb(17 17 16 / 0.06)"
  red: "#e5231b"
  red-ink: "#b81810"
  red-wash: "rgb(229 35 27 / 0.1)"
  red-solid: "#e01f17"
  red-solid-hover: "#b81810"
  on-red: "#ffffff"
  band: "#111110"
  band-rule: "#333331"
  band-ink: "#f5f5f2"
  band-ink-2: "#a3a39b"
  good: "#1d7a46"
  warn: "#9a6200"
  bad: "#c41a12"
  focus: "#e5231b"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4rem, 12vw, 9rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.05em"
    fontFeature: "\"ss01\", \"tnum\""
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "\"ss01\", \"tnum\""
  figure:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.04em"
    fontFeature: "\"ss01\", \"tnum\""
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    letterSpacing: "-0.015em"
    fontFeature: "\"ss01\", \"tnum\""
  section:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontFeature: "\"ss01\", \"tnum\""
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"tnum\""
  body-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"tnum\""
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.02em"
    fontFeature: "\"ss01\", \"tnum\""
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.92em"
    fontWeight: 400
rounded:
  none: "0"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  gutter: "24px"
  margin: "32px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-primary:
    backgroundColor: "{colors.red-solid}"
    textColor: "{colors.on-red}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.red-solid-hover}"
    textColor: "{colors.on-red}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.bad}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-danger-hover:
    backgroundColor: "{colors.bad}"
    textColor: "#ffffff"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "34px"
  segment-hover:
    backgroundColor: "{colors.paper-2}"
  segment-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0 4px 0 12px"
    height: "30px"
  band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-ink}"
    padding: "0 32px"
    height: "52px"
  tab:
    textColor: "{colors.band-ink-2}"
    typography: "{typography.body-sm}"
    padding: "0 12px"
  tab-active:
    textColor: "{colors.band-ink}"
---

# Design System: Lanternfish

## Overview

**Creative North Star: "The Swiss Timetable"**

Lanternfish reads like a departures board printed on paper: a visible 12-column grid, flush-left type, and numbers that line up in tabular columns. Every screen leads with a figure. Structure comes from 1px hairlines and the drawn column grid, never from boxes, so the page stays a single continuous sheet rather than a wall of tiles.

The palette is paper and ink with one Swiss red. Red marks exactly what is current: the live series, the selected tab, the focused field, the primary action, the length of a ranked bar. Grey ink carries the previous period. Light and dark follow the system setting with the same roles; in dark the paper becomes night ink and the red brightens.

Density is high but calm. Type is one family, Geist, at a ~1.2 ratio, set tight at the large sizes and sentence case everywhere. Motion is short state change, not choreography.

**Key Characteristics:**

- A black top band, then the paper sheet on a 12-column grid with 24px gutters.

- The column grid is drawn as faint hairlines behind the figure band and the chart.

- Square corners on every control (0 radius); 1px hairlines; no elevation shadows.

- One accent, red, reserved for "current" and "act".

- Geist with tabular figures and stylistic set 01 on the root; Geist Mono only for code, keys and ids.

## Colors

Warm-neutral paper and ink (hue ~107, near zero chroma) with a single saturated red.

### Primary

- **Swiss Red** (`red`): the current series line and its fill, the active tab underline, the ranked-bar rule, the caret, the checkbox accent, the live pulse. In dark it becomes #ff4a3d.

- **Solid Red** (`red-solid`, hover `red-solid-hover`): every red surface that carries white text (`on-red`): the primary button, text selection, the chip's remove hover. Tuned for 4.5:1 with white in both themes (dark #cc1a10, hover #a8150d), because the brighter line red fails under white text.

- **Pressed Red** (`red-ink`): red text on paper where it must read as text. In dark #ff6b60.

- **Red Wash** (`red-wash`): the area fill under the current series. Never used as a surface for text.

### Neutral

- **Paper** (`paper`): the page ground and field fill. Dark: night ink #0f0f0e.

- **Paper Shade** (`paper-2`): tonal wells only, for code blocks, key boxes, funnel tracks, skeletons and segment hover. Dark #181816.

- **Ink** (`ink`): primary text, the pressed segment, chips, the secondary series line. Dark #ededea.

- **Ink Two** (`ink-2`): labels, table headers, secondary copy. Dark #b4b4ad.

- **Ink Three** (`ink-3`): meta text, axis labels, hints, the previous-period line and the neutral delta. Dark #8c8c85.

- **Hairline** (`rule`): every row divider, figure divider and quiet border. Dark #2c2c29.

- **Strong Rule** (`rule-strong`): the rule that opens a block (figure band top, section header underline, sites list top, chart baseline) and the outline of buttons and segments. It equals ink in both themes.

- **Column Rule** (`grid`): the drawn column grid, ink at 6% (5% in dark).

- **Band Black** (`band`), **Band Ink** (`band-ink`), **Band Grey** (`band-ink-2`): the top band, its active text and its idle text. Dark band is pure #000.

### Status

- **Good** (`good`), **Warn** (`warn`), **Bad** (`bad`): deltas, Web Vitals ratings, messages, the danger button and the danger-zone rule. Dark #4cc27f, #e0a53a, #ff6b60. Bad sits near red in hue; it is reserved for errors and destructive actions and is always paired with words.

### Named Rules

**The One Red Rule.** Red means "current" or "act". If an element is neither the live series, the selection, the focus, nor the primary action, it is not red.

**The Previous Is Grey Rule.** Comparison data is drawn in ink-3, dashed (4 4), never in a second hue.

## Typography

**Display Font:** Geist Variable (with ui-sans-serif, system-ui)

**Body Font:** Geist Variable

**Label/Mono Font:** Geist Mono Variable (with ui-monospace, SF Mono, Menlo), code, keys and ids only

**Character:** One grotesk carrying everything, from 9rem live counts to 11px axis labels. Large sizes tighten hard (-0.035em to -0.05em); small sizes sit at normal or slightly open tracking.

### Hierarchy

- **Display** (700, clamp 4rem to 9rem, 0.9): the realtime visitor count. The login wordmark is its sibling (750, clamp 4rem to 9rem, 0.88, the full stop in red).

- **Headline** (700, 3rem, 1): the site name in the page head; 2.25rem below 760px.

- **Figure** (650, 3rem, 1.05, tabular): the four values in the figure band; 2.25rem below 760px.

- **Title** (650, 1.125rem): site names in the sites list. Its numeric sibling is 600 at 1.5rem, -0.02em.

- **Section** (700, 0.9375rem, -0.01em): section headings, the same size as body, separated by weight and the strong rule beneath.

- **Body** (400, 0.9375rem, 1.5): default text. Notes cap at 70ch, empty states at 52ch.

- **Body Small** (0.8125rem): controls, tabs, bar keys, table cells, deltas, readouts.

- **Label** (600, 0.75rem, 0.02em, sentence case): figure labels, field labels, table headers, meta.

- **Axis** (11px, tabular, ink-3): chart axis labels only.

### Named Rules

**The Tabular Rule.** Every number that can sit beside another number is tabular (`tnum` on the root, `tabular-nums` restated on values, deltas, bars, tables and readouts).

**The Sentence Case Rule.** Labels are sentence case at 0.02em. Nothing in the system is set in uppercase.

## Layout

A 12-column grid (`minmax(0, 1fr)` columns, 24px gutter) inside a 1440px page with 32px side margins and 64px bottom padding. Below 760px it becomes 4 columns with 16px gutters and margins; spans of 4 to 12 go full width and 3-spans become 2 of 4. Between 760px and 1080px, 4-spans widen to 6.

Spacing runs on an 8px rhythm with a 4px half-step: 4, 8, 12, 16, 24, 32, 48, 64. The page head opens with 48px above (32px on mobile); sections open with 32px.

The overview is composed on the grid: the site name at 5 or 7 columns, the range controls in the remainder, right-aligned (left-aligned on mobile); the four-figure band at 3 columns each; the chart across all 12; breakdowns in 6-column pairs and 4-column triples.

### Named Rules

**The Drawn Grid Rule.** The column grid is visible. A repeating 1px gradient in the column-rule color, sized to `(100% + gutter) / cols`, runs behind the figure band and the chart. Breakdown bars are 2px red rules on the row's bottom hairline, their length the share of the top row. This is the system's signature; apply it to any block whose figures or plotted values should read against the columns.

**The Strong Opener Rule.** A block opens with a 1px ink rule (figure band, section header, sites list, login form) and its rows divide with 1px hairlines.

## Elevation & Depth

Flat. There are no elevation shadows anywhere. Depth is a hierarchy of rules: the strong ink rule opens, the hairline divides, the column rule recedes behind. The only tonal step is paper-shade, used as a recessed well for code, keys, tracks and loading bars. The single box-shadow in the build is an inset 2px red line under a focused field, which reads as an underline, not a lift.

### Named Rules

**The No Lift Rule.** Nothing floats. State is shown by inverting (ink fill, paper text), underlining in red, or changing the rule color, never by a drop shadow.

## Shapes

Square. Every control, chip, field, segment, swatch and marker has 0 radius; the chart hover marker is a 7px square and the live pulse a 10px square. Lines are 1px hairlines, 2px for emphasis (current series, tab underline, bar rule, focus). Authored icons sit on a 16px grid with a 1.5 stroke and square caps. The fish mark is the one curved form, and it keeps a square red lantern.

## Components

### Buttons

Outlined in ink, inverting on hover.

- **Shape:** square (0), 36px tall, 16px side padding, 1px border, 14px icon with 8px gap.

- **Default:** transparent with an ink border and ink text, 600 weight; hover fills ink with paper text.

- **Primary:** solid red fill and border with white text; hover steps to the darker solid red.

- **Quiet:** hairline border instead of ink; used for copy actions.

- **Danger:** bad-colored border and text; hover fills bad with white text.

- **Disabled / Busy:** 50% opacity, not-allowed, no pointer events.

- **Motion:** background and color over 150ms on `cubic-bezier(0.16, 1, 0.3, 1)`.

### Segmented control

The range presets. A 1px ink outline around 34px buttons divided by hairlines; hover is paper-shade; the pressed preset inverts to ink with paper text.

### Chips

Active filters. An ink block with paper text, 30px tall, the dimension name at 70% paper and the value at full. A 24px square close target that turns red on hover.

### Inputs / Fields

- **Style:** paper fill, 1px hairline border with an ink-3 bottom edge, 0 radius, 40px tall, body size. Textareas are 88px, in Geist Mono at body-small.

- **Hover:** border goes ink-3 all round.

- **Focus:** border goes ink and a 2px red line appears inside the bottom edge; the default outline is suppressed here only.

- **Error:** border in bad, with a message in bad below.

- **Label:** label style above, 4px gap; hints in ink-3 at label size.

- **Date and checkbox:** dates are 34px with a hairline border; checkboxes are 16px with a red accent.

### Navigation

The black band: 52px, wordmark at 700 with the mark at 18px, a site switcher set off by a left rule, tabs at body-small 500 in band grey. Hover brings band ink; the current tab is band ink with a 2px red underline. Below 760px the tabs wrap to their own scrolling row at 40px and the usage meter hides.

### Figure band

Four figures on 3 columns each between a strong rule above and a hairline below, divided by vertical hairlines, over the drawn grid. Each is label, value and a delta ("+12% vs previous") in body-small 600: good when better, bad when worse, ink-3 when flat. On mobile they stack two by two, divided by horizontal hairlines.

### Bar list

Ranked rows at least 34px tall: key (a button that filters the page), value at 600, percentage at label size in ink-3, right-aligned in 4ch. Each row's bottom hairline carries a 2px red rule sized to its share of the top row, easing its width over 250ms. "Show all" is a text button at label size.

### Line chart

240px tall, full width, hand-drawn SVG. Views in red at 2px over the red wash; visitors in ink at 1.25px; the previous period in ink-3 dashed 4 4. Hairline ticks at half and full scale, a strong-rule baseline. Hover or arrow keys move a 1px ink hairline and a red square marker, and the legend row becomes a readout of the point.

### Section

A heading and optional meta set on a baseline over a strong rule, then content. Default span is 6 columns.

### Tables

Body-small cells, label-style headers in ink-2, 8px vertical padding, hairline row dividers, right-aligned tabular numeric columns, paths truncated at 28ch.

### Status and loading

Skeleton bars are paper-shade blocks pulsing to 50% over 1.4s. The realtime pulse is a 10px red square fading to 25% over 2s. All animation and transition stops under reduced motion. Focus is a 2px red outline offset 2px everywhere else.

## Do's and Don'ts

### Do:

- **Do** place everything on the 12-column grid and draw the columns behind figures and charts.

- **Do** open each block with a 1px ink rule and divide its rows with 1px hairlines.

- **Do** keep red for the current series, the selection, focus and the primary action.

- **Do** show the previous period in ink-3, dashed 4 4.

- **Do** set every comparable number in tabular figures.

- **Do** show state by inversion (ink fill, paper text) or a 2px red underline.

- **Do** keep state transitions at 150ms on the house ease; 250ms is reserved for bar lengths.

### Don't:

- **Don't** round corners on controls, chips, fields or markers.

- **Don't** use drop shadows or lifted cards; the only shadow is the inset focus underline.

- **Don't** put content in bordered or filled tiles; paper-shade is for recessed wells (code, keys, tracks, skeletons) only.

- **Don't** introduce a second accent hue or color the previous period.

- **Don't** set labels in uppercase or add eyebrow text above headings.

- **Don't** use Geist Mono for prose or numbers; it is for code, keys and ids.
