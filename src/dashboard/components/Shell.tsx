import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { FREE_REQUESTS_PER_DAY } from "../../shared/constants";
import type { Me, Usage } from "../../shared/types";
import { api, isShareMode, useApi } from "../api";
import { num } from "../format";
import { Lantern } from "../icons";

/** Today's share of the daily budget. Stays visible on phones as a short line. */
function UsageMeter() {
  const { data } = useApi<Usage>("/usage", 60_000);
  if (!data) return null;
  const account = data.scope === "account";
  const share = Math.max((account ? data.events : data.rows_written) / data.budget, data.rows_read / data.read_budget);
  const p = Math.round(share * 100);
  const level = share > 0.8 ? "high" : share > 0.6 ? "warm" : "";
  const title = account
    ? `Today (UTC): ${num(data.events)} of ${num(data.budget)} events, ${num(data.rows_read)} of ${num(data.read_budget)} reads, against your account limits`
    : `Today (UTC): ${num(data.rows_written)} of ${num(data.budget)} D1 rows written, ${num(data.rows_read)} of ${num(data.read_budget)} rows read, ${num(data.requests)} accepted ingest requests (Workers allows ${num(FREE_REQUESTS_PER_DAY)} requests a day)`;
  return (
    <div class={`usage ${level}`} title={title}>
      <span class="usage-label">
        <span class="long">Daily </span>budget
      </span>
      <span class="usage-num">{p}%</span>
      <span class="usage-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={account ? "Share of today's account limits used" : "Share of today's free-tier budget used"}>
        <span style={{ "--w": String(Math.min(1, share)) }} />
      </span>
      {level && <span class={`stamp ${level === "high" ? "bad" : "wait"}`}>{level === "high" ? "Near limit" : "Busy"}</span>}
    </div>
  );
}

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_NAME: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

/** Cycles system, light and dark. index.html applies the saved choice before first paint. */
function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme | undefined) ?? "system");
  const next = () => {
    const t = NEXT[theme];
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("lf-theme");
      else localStorage.setItem("lf-theme", t);
    } catch {
      // Private mode: the choice lasts until reload.
    }
    setTheme(t);
  };
  return (
    <button type="button" class="bar-icon" onClick={next} aria-label={`${THEME_NAME[theme]}. Switch to ${THEME_NAME[NEXT[theme]].toLowerCase()}`} title={THEME_NAME[theme]}>
      <Lantern mode={theme} />
    </button>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** g then o, r or s jumps between a site's tabs. */
function useTabKeys(tabs: { href: string; key: string }[]) {
  const { route } = useLocation();
  useEffect(() => {
    if (!tabs.length) return;
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "g") {
        armed = Date.now();
        return;
      }
      if (armed && Date.now() - armed < 1200) {
        const t = tabs.find((x) => x.key === e.key);
        armed = 0;
        if (t) {
          e.preventDefault();
          route(t.href);
        }
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [tabs.map((t) => t.href).join()]);
}

/** The top bar: serif wordmark, site switcher, tabs, budget, theme and sign out. */
export function Shell({ siteId, children }: { siteId?: string | undefined; children: ComponentChildren }) {
  const { path, route } = useLocation();
  const share = isShareMode();
  const sites = useApi<{ id: string; name: string }[]>(share ? null : "/sites/list");
  const me = useApi<Me>(share ? null : "/me");
  const tabs =
    siteId && !share
      ? [
          { href: `/s/${siteId}`, label: "Overview", key: "o" },
          { href: `/s/${siteId}/live`, label: "Realtime", key: "r" },
          { href: `/s/${siteId}/settings`, label: "Settings", key: "s" },
        ]
      : [];
  useTabKeys(tabs);

  const signOut = async () => {
    await api.post("/logout").catch(() => {});
    location.assign("/login");
  };

  return (
    <>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <header class="topbar">
        <div class="bar-inner">
          {share ? (
            <span class="wordmark">Lanternfish</span>
          ) : (
            <a class="wordmark" href="/">
              Lanternfish
            </a>
          )}
          {!share && siteId && sites.data && sites.data.length > 1 && (
            <label class="site-switch">
              <span class="sr-only">Site</span>
              <select value={siteId} onChange={(e) => route(`/s/${(e.target as HTMLSelectElement).value}`)}>
                {sites.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tabs.length > 0 && (
            <nav class="bar-nav" aria-label="Site">
              <ul class="tabs">
                {tabs.map((t) => (
                  <li key={t.href}>
                    <a href={t.href} aria-current={path === t.href ? "page" : undefined} aria-keyshortcuts={`g ${t.key}`} title={`${t.label} (g then ${t.key})`}>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <span class="bar-spacer" />
          {!share && <UsageMeter />}
          <ThemeSwitch />
          {!share && me.data?.mode === "cloud" && (
            <a class="linkish" href="/account" aria-current={path === "/account" ? "page" : undefined}>
              Account
            </a>
          )}
          {!share && (
            <button type="button" class="linkish" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main class="page" id="main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
