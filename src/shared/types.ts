export type Props = Record<string, string | number>;

/** One browser event on the wire. Short keys keep the tracker small. */
export interface ClientEvent {
  /** name */
  n: string;
  /** path */
  p: string;
  /** referrer host */
  r?: string;
  /** ?ref= or utm_source tag */
  t?: string;
  /** props */
  pr?: Props;
}

export interface ClientBatch {
  /** site id */
  s: string;
  /** page-load id, in memory only */
  pl: string;
  e: ClientEvent[];
}

export interface ServerEventBody {
  site: string;
  name: string;
  props?: Props;
  ip?: string;
  ua?: string;
  path?: string;
}

export interface Site {
  id: string;
  account_id: number;
  name: string;
  domains: string[];
  timezone: string;
  public: boolean;
  server_key: string;
  exclude_paths: string[];
  funnel: string[];
  share_nonce: string;
  created: number;
}

export type SiteInput = Pick<Site, "name" | "domains" | "timezone" | "public" | "exclude_paths" | "funnel">;

/** Inclusive range of local days, `YYYY-MM-DD`. */
export interface Range {
  from: string;
  to: string;
}

export const FILTER_DIMS = ["path", "ref", "tag", "country", "device", "browser", "os", "event"] as const;
export type FilterDim = (typeof FILTER_DIMS)[number];
export type Filters = Partial<Record<FilterDim, string>>;

export interface Row {
  key: string;
  value: number;
}

export interface Totals {
  views: number;
  uniques: number;
  loads: number;
  bounces: number;
  visibleMsP50: number;
}

export interface SeriesPoint {
  t: string;
  views: number;
  uniques: number;
}

export interface Stats {
  range: Range;
  compare?: Range;
  totals: Totals;
  prevTotals?: Totals;
  series: SeriesPoint[];
  prevSeries?: SeriesPoint[];
  pages: Row[];
  refs: Row[];
  tags: Row[];
  countries: Row[];
  devices: Row[];
  browsers: Row[];
  os: Row[];
  outbound: Row[];
  events: Row[];
  notFound: Row[];
  eventProps: Record<string, Record<string, Row[]>>;
  funnel: { section: string; loads: number }[];
  agents: { bot: string; path: string; value: number }[];
  vitals: { path: string; lcp?: number; inp?: number; cls?: number }[];
  filtered: boolean;
}

export interface SiteSummary {
  site: Site;
  views: number;
  uniques: number;
  /** views per day, oldest first, 30 entries */
  spark: number[];
}

export interface Usage {
  day: string;
  requests: number;
  events: number;
  rows_written: number;
  rows_read: number;
  budget: number;
  read_budget: number;
}

export interface Realtime {
  visitors: number;
  pages: Row[];
}

export interface PublicStats {
  name: string;
  range: Range;
  totals: Totals;
  series: SeriesPoint[];
  pages: Row[];
}
