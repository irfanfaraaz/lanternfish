// Lanternfish tracker. Cookieless; nothing is stored except the owner's
// own opt-out flag. Built to dist/public/lf.js by scripts/build-tracker.ts.
import { WIDTH_BUCKETS } from "../shared/constants";
import type { ClientEvent, Props } from "../shared/types";

type Lf = ((name: string, props?: Props) => void) & { q?: ArrayLike<unknown>[] };
type PerfEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean; interactionId?: number };

((w: Window & { lf?: Lf }, d: Document) => {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const script = d.currentScript as HTMLScriptElement | null;
  const site = script?.dataset.site;
  if (!script || !site) return;
  const api = script.dataset.api || `${new URL(script.src).origin}/e`;
  const pending = w.lf?.q ?? [];

  let off = false;
  try {
    const flag = new URLSearchParams(location.search).get("lf");
    if (flag === "off") localStorage.setItem("lf_off", "1");
    if (flag === "on") localStorage.removeItem("lf_off");
    off = localStorage.getItem("lf_off") === "1";
  } catch {}
  if (off || nav.globalPrivacyControl || nav.webdriver) {
    w.lf = () => {};
    return;
  }

  const now = () => performance.now();
  const pl = Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => (b % 36).toString(36)).join("");
  let queue: ClientEvent[] = [];
  let sent = 0;
  let path = "";
  let firstPath = "";
  let visibleMs = 0;
  let shownAt = d.visibilityState === "visible" ? now() : 0;

  const flush = () => {
    if (!queue.length) return;
    const body = JSON.stringify({ s: site, pl, e: queue });
    queue = [];
    // A CORS-mode fetch always sends the real Origin (a no-cors sendBeacon
    // sends "null" under a strict Referrer-Policy). A string body is
    // text/plain, so there is no preflight; keepalive outlives the page.
    fetch(api, { method: "POST", body, keepalive: true }).catch(() => {});
  };

  const name = (s: string) => s.toLowerCase().replace(/[^a-z0-9_:]/g, "_").slice(0, 40);
  const cut = (p: string) => p.slice(0, 200);

  const push = (e: ClientEvent) => {
    if (sent >= 50) return;
    e.p = cut(e.p);
    sent++;
    queue.push(e);
    if (queue.length >= 10) flush();
  };

  const leave = () => {
    if (shownAt) {
      visibleMs += now() - shownAt;
      shownAt = d.visibilityState === "visible" ? now() : 0;
    }
    const ms = Math.min(Math.round(visibleMs), 86_400_000);
    visibleMs = 0;
    if (path && ms > 0) push({ n: "leave", p: path, pr: { ms } });
  };

  const pageview = () => {
    const p = location.pathname;
    if (p === path) return;
    if (path) leave();
    const x = innerWidth;
    const e: ClientEvent = { n: "pageview", p, pr: { w: WIDTH_BUCKETS[x < 576 ? 0 : x < 768 ? 1 : x < 992 ? 2 : x < 1440 ? 3 : 4] } };
    if (!path) {
      firstPath = p;
      try {
        const ref = d.referrer && new URL(d.referrer).hostname;
        if (ref && ref !== location.hostname) e.r = ref;
      } catch {}
      const params = new URLSearchParams(location.search);
      const tag = params.get("ref") || params.get("utm_source");
      if (tag) e.t = tag.slice(0, 100);
    }
    path = p;
    push(e);
    requestAnimationFrame(() => d.documentElement.hasAttribute("data-lf-404") && push({ n: "not_found", p }));
  };

  // Client-side navigation.
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History["pushState"]>) {
      orig.apply(this, args);
      pageview();
    };
  }
  addEventListener("popstate", pageview);

  // Clicks: data-lf-click elements first, then outbound links.
  const onClick = (ev: Event) => {
    const t = ev.target as Element | null;
    if (!t?.closest) return;
    const el = t.closest<HTMLElement>("[data-lf-click]");
    if (el) {
      const pr: Props = {};
      let k = 0;
      for (const [key, v] of Object.entries(el.dataset)) {
        if (key.startsWith("lfProp") && v !== undefined && k++ < 5) {
          pr[name(key.slice(6).replace(/[A-Z]/g, (c, i: number) => (i ? "_" : "") + c))] = v.slice(0, 100);
        }
      }
      push({ n: name(el.dataset.lfClick!), p: path, pr });
      return flush();
    }
    const a = t.closest<HTMLAnchorElement>("a[href]");
    if (a && /^https?:$/.test(a.protocol) && a.hostname !== location.hostname) {
      push({ n: "outbound", p: path, pr: { host: a.hostname } });
      flush();
    }
  };
  d.addEventListener("click", onClick, true);
  d.addEventListener("auxclick", onClick, true);

  // Sections: seen once per page load when half of it, or half the viewport, is
  // covered. Thresholds halve down to 1/1024 so even a section 1000 screens
  // tall crosses one, and sizes are read live so late images and rotation
  // don't matter.
  const seen = new Set<string>();
  const watched = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const x of entries) {
        const el = x.target as HTMLElement;
        const sec = name(el.dataset.lfSection || "");
        const vh = x.rootBounds?.height || innerHeight;
        if (x.isIntersecting && (x.intersectionRatio >= 0.5 || x.intersectionRect.height >= vh / 2)) {
          io.unobserve(el);
          if (sec && !seen.has(sec)) {
            seen.add(sec);
            push({ n: "section_seen", p: path, pr: { section: sec } });
          }
        }
      }
    },
    { threshold: [0, ...Array.from({ length: 11 }, (_, i) => 2 ** -i)] },
  );
  const watch = (el: HTMLElement) => {
    if (watched.has(el)) return;
    watched.add(el);
    io.observe(el);
  };
  let scanTimer = 0;
  const scan = () => {
    scanTimer = 0;
    d.querySelectorAll<HTMLElement>("[data-lf-section]").forEach(watch);
  };
  new MutationObserver(() => {
    scanTimer ||= setTimeout(scan, 200) as unknown as number;
  }).observe(d.documentElement, { childList: true, subtree: true });

  // Core Web Vitals from the browser's own APIs.
  let lcp = 0;
  let inp = 0;
  let cls = 0;
  let win = 0;
  let winStart = 0;
  let winLast = 0;
  let vitalsSent = false;
  const observe = (type: string, cb: (e: PerfEntry) => void, opts: object = {}) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...opts });
      return true;
    } catch {
      return false;
    }
  };
  observe("largest-contentful-paint", (e) => (lcp = e.startTime));
  const hasCls = observe("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    if (win && e.startTime - winLast < 1000 && e.startTime - winStart < 5000) win += e.value ?? 0;
    else {
      win = e.value ?? 0;
      winStart = e.startTime;
    }
    winLast = e.startTime;
    cls = Math.max(cls, win);
  });
  observe("event", (e) => e.interactionId && (inp = Math.max(inp, e.duration)), { durationThreshold: 16 });

  const hide = () => {
    leave();
    if (!vitalsSent) {
      vitalsSent = true;
      const pr: Props = {};
      if (lcp) pr.lcp = Math.round(lcp);
      if (inp) pr.inp = Math.round(inp);
      if (hasCls) pr.cls = Math.round(cls * 1000) / 1000;
      if (Object.keys(pr).length) push({ n: "vitals", p: firstPath, pr });
    }
    flush();
  };
  d.addEventListener("visibilitychange", () => (d.visibilityState === "hidden" ? hide() : (shownAt = now())));
  addEventListener("pagehide", hide);

  w.lf = (n, props) => {
    if (typeof n === "string") push({ n: name(n), p: path, ...(props ? { pr: props } : {}) });
  };

  pageview();
  scan();
  for (const args of pending) w.lf(args[0] as string, args[1] as Props);
  setInterval(flush, 5000);
})(window, document);
