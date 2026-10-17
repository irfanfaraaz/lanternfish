import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { FREE_REQUESTS_PER_DAY } from "../../shared/constants";
import type { Usage } from "../../shared/types";
import { api, isShareMode, useApi } from "../api";
import { num } from "../format";
import { Lantern, Mark } from "../icons";

function UsageMeter() {
  const { data } = useApi<Usage>("/usage", 60_000);
  if (!data) return null;
  const share = Math.max(data.rows_written / data.budget, data.rows_read / data.read_budget);
  return (
    <div
      class="usage"
      title={`Today (UTC): ${num(data.rows_written)} of ${num(data.budget)} D1 rows written, ${num(data.rows_read)} of ${num(data.read_budget)} rows read, ${num(data.requests)} accepted ingest requests (Workers allows ${num(FREE_REQUESTS_PER_DAY)} requests a day)`}
    >
      <span>D1 {Math.round(share * 100)}%</span>
      <span class={`usage-bar${share > 0.8 ? " high" : share > 0.6 ? " warm" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label="Share of today's D1 budget used">
        <span style={{ width: `${Math.min(100, share * 100)}%` }} />
      </span>
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
    <button type="button" class="band-icon" onClick={next} aria-label={`${THEME_NAME[theme]}. Switch to ${THEME_NAME[NEXT[theme]].toLowerCase()}`} title={THEME_NAME[theme]}>
      <Lantern mode={theme} />
    </button>
  );
}

/** The black band: wordmark, site switcher, tabs, usage and sign out. */
export function Shell({ siteId, children }: { siteId?: string | undefined; children: ComponentChildren }) {
  const { path, route } = useLocation();
  const share = isShareMode();
  const sites = useApi<{ id: string; name: string }[]>(share ? null : "/sites/list");
  const tabs = siteId
    ? [
        { href: `/s/${siteId}`, label: "Overview" },
        { href: `/s/${siteId}/live`, label: "Realtime" },
        { href: `/s/${siteId}/settings`, label: "Settings" },
      ]
    : [];

  const signOut = async () => {
    await api.post("/logout").catch(() => {});
    location.assign("/login");
  };

  return (
    <>
      <header class="band">
        <div class="band-inner">
          <a class="wordmark" href={share ? undefined : "/"}>
            <Mark />
            <span class="wordmark-text">Lanternfish</span>
          </a>
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
          {!share && tabs.length > 0 && (
            <nav class="band-nav" aria-label="Site">
              <ul class="tabs">
                {tabs.map((t) => (
                  <li key={t.href}>
                    <a href={t.href} aria-current={path === t.href ? "page" : undefined}>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <span class="band-spacer" />
          {!share && <UsageMeter />}
          <ThemeSwitch />
          {!share && (
            <button type="button" class="linkish" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main class="page">{children}</main>
    </>
  );
}
