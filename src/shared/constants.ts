export const MAX_BODY = 8192;
export const MAX_EVENTS = 50;
export const MAX_PROPS = 5;
export const MAX_STR = 100;
export const MAX_PATH = 200;
export const NAME_RE = /^[a-z0-9_:]{1,40}$/;
export const RATE_PER_MIN = 300;

export const RESERVED = ["pageview", "leave", "outbound", "section_seen", "not_found", "vitals", "agent"] as const;
export type ReservedName = (typeof RESERVED)[number];

/** Screen-width buckets, upper bounds exclusive: <576, <768, <992, <1440, ≥1440. */
export const WIDTH_BUCKETS = ["xs", "sm", "md", "lg", "xl"] as const;
export type WidthBucket = (typeof WIDTH_BUCKETS)[number];

/** Cloudflare free-tier limits shown on the usage meter. */
export const FREE_REQUESTS_PER_DAY = 100_000;
export const FREE_ROWS_WRITTEN_PER_DAY = 100_000;

export const BOUNCE_MS = 10_000;
