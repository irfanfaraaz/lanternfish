// Authored icons: 16px grid, 1.5 stroke, square caps.
const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "square", "aria-hidden": true } as const;

export const Mark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 15c3.5-5 10-5 14 0-4 5-10.5 5-14 0Z" stroke="currentColor" stroke-width="1.75" style={{ color: "var(--band-ink)" }} />
    <path d="M17 15l4-3v6z" fill="var(--band-ink)" />
    <path d="M7.5 11.5C7.5 7.5 10 5 13.5 4.5" stroke="var(--band-ink)" stroke-width="1.25" />
    <rect x="13" y="2.5" width="4" height="4" fill="currentColor" />
  </svg>
);

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
