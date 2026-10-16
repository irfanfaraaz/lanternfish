import { useLocation } from "preact-iso";
import { FILTER_DIMS, type Filters, type Range } from "../shared/types";
import { addDays, todayIn } from "./format";

export const PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
] as const;

export type Preset = (typeof PRESETS)[number]["id"] | "custom";

export interface ViewState {
  preset: Preset;
  range: Range;
  compare: boolean;
  filters: Filters;
}

const isDay = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The overview's range, compare and filters, kept in the URL so views can be shared and bookmarked. */
export function useView(tz: string) {
  const { query, path, route } = useLocation();
  const today = todayIn(tz);

  let preset: Preset = (query.r as Preset) || "7d";
  let range: Range;
  if (isDay(query.from) && isDay(query.to) && query.from <= query.to) {
    preset = "custom";
    range = { from: query.from, to: query.to };
  } else {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1];
    preset = p.id;
    range = { from: addDays(today, -(p.days - 1)), to: today };
  }
  const filters: Filters = {};
  for (const d of FILTER_DIMS) {
    const val = query[`f.${d}`];
    if (val) filters[d] = val;
  }
  const view: ViewState = { preset, range, compare: query.cmp !== "0", filters };

  const go = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { ...query, ...next };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") q.set(k, v);
    const s = q.toString();
    route(s ? `${path}?${s}` : path, true);
  };

  return {
    view,
    today,
    setPreset: (id: Exclude<Preset, "custom">) => go({ r: id, from: undefined, to: undefined }),
    setCustom: (from: string, to: string) => go({ r: undefined, from, to }),
    setCompare: (on: boolean) => go({ cmp: on ? undefined : "0" }),
    addFilter: (dim: keyof Filters, value: string) => go({ [`f.${dim}`]: value }),
    removeFilter: (dim: keyof Filters) => go({ [`f.${dim}`]: undefined }),
  };
}

/** Query string for /stats from a view. */
export function statsQuery(v: ViewState): string {
  const q = new URLSearchParams({ from: v.range.from, to: v.range.to });
  if (v.compare) q.set("compare", "1");
  for (const [k, val] of Object.entries(v.filters)) if (val) q.set(`f.${k}`, val);
  return q.toString();
}
