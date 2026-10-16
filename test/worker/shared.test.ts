import { describe, expect, it } from "vitest";
import { BOT_UA_REGEX_SOURCE, KNOWN_BOTS, detectBot } from "../../src/shared/bots";
import { compileExcludes } from "../../src/shared/paths";
import { parseBatch, validEvent } from "../../src/shared/validate";

const ev = (n: string, pr?: Record<string, unknown>) => ({ n, p: "/", ...(pr ? { pr } : {}) }) as never;

describe("validate", () => {
  it("rejects >50 events", () => {
    const e = Array.from({ length: 51 }, () => ({ n: "pageview", p: "/" }));
    expect(parseBatch(JSON.stringify({ s: "a", pl: "b", e }))).toBeNull();
  });
  it("rejects bad json", () => expect(parseBatch("{nope")).toBeNull());
  it("accepts a minimal batch", () => expect(parseBatch('{"s":"a","pl":"b","e":[{"n":"pageview","p":"/"}]}')).not.toBeNull());
  it("drops event with uppercase name", () => expect(validEvent(ev("Click"))).toBe(false));
  it("drops 41-char name", () => expect(validEvent(ev("a".repeat(41)))).toBe(false));
  it("drops nested-object prop", () => expect(validEvent(ev("signup", { a: { b: 1 } }))).toBe(false));
  it("drops NaN and Infinity", () => {
    expect(validEvent(ev("x", { a: Number.NaN }))).toBe(false);
    expect(validEvent(ev("x", { a: Number.POSITIVE_INFINITY }))).toBe(false);
  });
  it("101-char string invalid, 100 valid", () => {
    expect(validEvent(ev("x", { a: "z".repeat(101) }))).toBe(false);
    expect(validEvent(ev("x", { a: "z".repeat(100) }))).toBe(true);
  });
  it("6 props invalid", () => expect(validEvent(ev("x", { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }))).toBe(false));
  it("leave requires integer ms", () => {
    expect(validEvent(ev("leave", { ms: 1200 }))).toBe(true);
    expect(validEvent(ev("leave", { ms: 1.5 }))).toBe(false);
    expect(validEvent(ev("leave"))).toBe(false);
  });
  it("section_seen requires section", () => {
    expect(validEvent(ev("section_seen", { section: "hero" }))).toBe(true);
    expect(validEvent(ev("section_seen"))).toBe(false);
  });
  it("pageview width bucket strict", () => {
    expect(validEvent(ev("pageview", { w: "md" }))).toBe(true);
    expect(validEvent(ev("pageview", { w: "huge" }))).toBe(false);
  });
  it("vitals needs one numeric metric", () => {
    expect(validEvent(ev("vitals", { lcp: 1200, cls: 0.02 }))).toBe(true);
    expect(validEvent(ev("vitals", {}))).toBe(false);
    expect(validEvent(ev("vitals", { fid: 3 }))).toBe(false);
  });
  it("agent strict props", () => {
    expect(validEvent(ev("agent", { bot: "GPTBot", path: "/llms.txt" }))).toBe(true);
    expect(validEvent(ev("agent", { bot: "GPTBot", path: "/x", extra: 1 }))).toBe(false);
  });
  it("path must start with /", () => expect(validEvent({ n: "pageview", p: "x" } as never)).toBe(false));
});

describe("bots", () => {
  it("ClaudeBot", () => expect(detectBot("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")).toBe("ClaudeBot"));
  it("Claude-SearchBot not ClaudeBot", () => expect(detectBot("Claude-SearchBot/1.0")).toBe("Claude-SearchBot"));
  it("OAI-SearchBot not GPTBot", () => expect(detectBot("OAI-SearchBot/1.0; +https://openai.com/searchbot")).toBe("OAI-SearchBot"));
  it("Chrome is human", () =>
    expect(detectBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBeNull());
  it("HeadlessChrome is other", () => expect(detectBot("Mozilla/5.0 HeadlessChrome/141.0")).toBe("other"));
  it("bot regex matches all known bots", () => {
    const re = new RegExp(BOT_UA_REGEX_SOURCE);
    for (const b of KNOWN_BOTS) expect(re.test(`Mozilla/5.0 (compatible; ${b.name}/1.0)`)).toBe(true);
  });
});

describe("paths", () => {
  it("/admin/* excludes /admin and /admin/x, keeps /administer", () => {
    const m = compileExcludes(["/admin/*"]);
    expect(m("/admin")).toBe(true);
    expect(m("/admin/x/y")).toBe(true);
    expect(m("/administer")).toBe(false);
  });
  it("middle wildcard and literal", () => {
    const m = compileExcludes(["/drafts/*/edit", "/secret"]);
    expect(m("/drafts/42/edit")).toBe(true);
    expect(m("/secret")).toBe(true);
    expect(m("/secret/2")).toBe(false);
  });
  it("no patterns excludes nothing", () => expect(compileExcludes([])("/a")).toBe(false));
});
