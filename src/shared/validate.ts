import { MAX_EVENTS, MAX_PATH, MAX_PROPS, MAX_STR, NAME_RE, WIDTH_BUCKETS } from "./constants";
import type { ClientBatch, ClientEvent, Props } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = MAX_STR): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Props: at most 5 keys, each a name, each value a short string or a finite number. Null if invalid. */
export function cleanProps(p: unknown): Props | null {
  if (!isObj(p)) return null;
  const keys = Object.keys(p);
  if (keys.length > MAX_PROPS) return null;
  const out: Props = {};
  for (const k of keys) {
    const v = p[k];
    if (!NAME_RE.test(k)) return null;
    if (typeof v === "string") {
      if (v.length > MAX_STR) return null;
      out[k] = v;
    } else if (isNum(v)) out[k] = v;
    else return null;
  }
  return out;
}

const only = (p: Props, allowed: string[]) => Object.keys(p).every((k) => allowed.includes(k));

/** Strict prop rules for reserved names; undefined for custom names. */
function reservedOk(name: string, p: Props): boolean | undefined {
  switch (name) {
    case "pageview":
      return only(p, ["w"]) && (p.w === undefined || (WIDTH_BUCKETS as readonly unknown[]).includes(p.w));
    case "leave":
      return only(p, ["ms"]) && isInt(p.ms, 0, 86_400_000);
    case "outbound":
      return only(p, ["host"]) && isStr(p.host);
    case "section_seen":
      return only(p, ["section"]) && typeof p.section === "string" && NAME_RE.test(p.section);
    case "not_found":
      return Object.keys(p).length === 0;
    case "vitals": {
      const keys = Object.keys(p);
      return keys.length > 0 && only(p, ["lcp", "inp", "cls"]) && keys.every((k) => isNum(p[k]) && (p[k] as number) >= 0);
    }
    case "agent":
      return only(p, ["bot", "path"]) && isStr(p.bot) && typeof p.path === "string" && p.path.startsWith("/");
    default:
      return undefined;
  }
}

export function validName(name: unknown): name is string {
  return typeof name === "string" && NAME_RE.test(name);
}

/** Validates a name with its props, applying the strict reserved-name rules. */
export function validNamedProps(name: string, props: Props): boolean {
  if (!NAME_RE.test(name)) return false;
  return reservedOk(name, props) ?? true;
}

export function validPath(p: unknown): p is string {
  return typeof p === "string" && p.startsWith("/") && p.length <= MAX_PATH * 10;
}

export function cutPath(p: string): string {
  return p.length > MAX_PATH ? p.slice(0, MAX_PATH) : p;
}

export function validEvent(e: ClientEvent): boolean {
  if (!isObj(e) || !validName(e.n) || !validPath(e.p)) return false;
  if (e.r !== undefined && !isStr(e.r)) return false;
  if (e.t !== undefined && !isStr(e.t)) return false;
  const props = e.pr === undefined ? {} : cleanProps(e.pr);
  if (!props) return false;
  return validNamedProps(e.n, props);
}

/** Parses a batch envelope. Individual events are checked later with validEvent. */
export function parseBatch(text: string): ClientBatch | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(v) || !isStr(v.s, 40) || !isStr(v.pl, 40) || !Array.isArray(v.e)) return null;
  if (v.e.length === 0 || v.e.length > MAX_EVENTS) return null;
  return { s: v.s, pl: v.pl, e: v.e as ClientEvent[] };
}
