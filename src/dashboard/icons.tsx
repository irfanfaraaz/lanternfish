// Authored icons: 16px grid, 1.5 stroke, round caps (Field Notes draws with a pen, not a ruler).
const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": true } as const;

export const Close = () => (
  <svg {...base}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const Copy = () => (
  <svg {...base}>
    <path d="M5.5 5.5h7v7h-7z" />
    <path d="M3.5 10.5v-7h7" />
  </svg>
);

export const Check = () => (
  <svg {...base}>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

export const Plus = () => (
  <svg {...base}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const Download = () => (
  <svg {...base}>
    <path d="M8 2.5v8M4.5 7l3.5 3.5L11.5 7M3 13.5h10" />
  </svg>
);

/** Shown on a bar-list row on hover or focus: the row filters the page. */
export const Funnel = () => (
  <svg {...base}>
    <path d="M2.5 3.5h11L9.25 8.5v4l-2.5 1.25V8.5z" />
  </svg>
);

/** The theme switch: a hanging lantern, unlit in light, lit in dark, half lit when it follows the system. */
export const Lantern = ({ mode }: { mode: "system" | "light" | "dark" }) => (
  <svg {...base} class={`lantern ${mode}`}>
    <path d="M8 1v2.5M5.5 3.5h5" />
    <rect x="4.75" y="5.75" width="6.5" height="7.5" rx="1.25" />
    <rect class="flame" x="5.5" y={mode === "system" ? 9.5 : 6.5} width="5" height={mode === "system" ? 3 : 6} rx="1" stroke="none" />
    <path d="M6 15h4" />
  </svg>
);

/**
 * Empty-state doodles: 2px round-capped ink strokes with one accent stroke in primary.
 * Decorative; the sentence next to them carries the message.
 */
export const DoodleFish = () => (
  <svg class="doodle" viewBox="0 0 96 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 30c10-15 34-17 50-1-15 15-40 15-50 1Z" />
    <path d="M64 29c6-4 10-8 14-9-1 6-1 12 0 18-4-1-8-5-14-9Z" />
    <circle cx="26" cy="27" r="1.6" fill="currentColor" />
    <path d="M38 22c3 4 3 10 0 14" />
    <path class="accent" d="M24 17c-2-6 1-11 7-13" />
    <path class="accent" d="M30 4.5c1.8-.8 3.6.5 3.2 2.4-.4 1.8-2.8 2.4-4 1" />
    <path d="M8 46c8-3 14 3 22 0s14-3 22 0 14 3 22 0" opacity=".45" />
  </svg>
);

export const DoodleLantern = () => (
  <svg class="doodle" viewBox="0 0 96 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M48 3v6M40 10c3-1 13-1 16 0" />
    <path d="M37 14c-1 9-1 22 0 31 7 2 15 2 22 0 1-9 1-22 0-31-7-2-15-2-22 0Z" />
    <path class="accent" d="M48 37c-5-3-4-9 0-14 4 5 5 11 0 14Z" />
    <path d="M42 50c4 1 8 1 12 0" />
    <path d="M18 30c2-1 4-1 6 0M72 30c2-1 4-1 6 0M22 18l4 3M74 18l-4 3" opacity=".45" />
  </svg>
);
