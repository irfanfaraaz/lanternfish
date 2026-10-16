import type { EventRow } from "../../src/worker/events";

/** Small deterministic PRNG (mulberry32). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATHS = ["/", "/work", "/about", "/blog/lanternfish", "/contact"];
const REFS = [null, null, "news.ycombinator.com", "google.com", "x.com"];
const COUNTRIES = ["IN", "US", "DE", "GB", null];
const SECTIONS = ["hero", "work", "contact"];

/**
 * A day of plausible traffic for one site: about 12 events per visit across
 * every event type. Timestamps fall between 00:00 and 23:59 UTC of `day`.
 */
export function generateDay(seed: number, siteId: string, day: string, visits: number): EventRow[] {
  const rnd = prng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");
  const start = Date.parse(`${day}T00:00:00Z`);
  const rows: EventRow[] = [];
  const visitors = Array.from({ length: Math.ceil(visits * 0.7) }, () => hex(16));

  for (let v = 0; v < visits; v++) {
    const visitor = pick(visitors);
    const pl = hex(14);
    const country = pick(COUNTRIES);
    let ts = start + Math.floor(rnd() * 86_000_000);
    const base = { site_id: siteId, day, pl, visitor, country, city: null, device: pick(["desktop", "mobile"]), browser: pick(["Chrome", "Safari"]), os: pick(["macOS", "iOS"]) };
    const ev = (name: string, path: string, props: Record<string, unknown> | null, extra: Partial<EventRow> = {}): EventRow => ({
      ...base,
      ts: ts++,
      name,
      path,
      ref: null,
      tag: null,
      props: props ? JSON.stringify(props) : null,
      ...extra,
    });

    const views = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < views; i++) {
      const path = pick(PATHS);
      rows.push(ev("pageview", path, { w: "lg" }, i === 0 ? { ref: pick(REFS), tag: rnd() < 0.1 ? "newsletter" : null } : {}));
      for (const s of SECTIONS) if (rnd() < 0.6) rows.push(ev("section_seen", path, { section: s }));
      rows.push(ev("leave", path, { ms: Math.floor(rnd() * 60_000) }));
    }
    if (rnd() < 0.3) rows.push(ev("contact_click", "/", { method: pick(["email", "linkedin"]) }));
    if (rnd() < 0.2) rows.push(ev("outbound", "/work", { host: pick(["github.com", "linkedin.com"]) }));
    if (rnd() < 0.05) rows.push(ev("not_found", "/old-page", null));
    rows.push(ev("vitals", "/", { lcp: Math.floor(rnd() * 4000), cls: Math.round(rnd() * 300) / 1000 }));
    if (rnd() < 0.1) {
      rows.push({ ...ev("agent", "/llms.txt", { bot: pick(["GPTBot", "ClaudeBot"]), path: "/llms.txt" }), pl: null, visitor: null, country: null });
    }
  }
  return rows;
}
