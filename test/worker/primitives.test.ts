import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Site } from "../../src/shared/types";
import { clearSaltCache, getSalt, hmacHex, randomId, visitorHash } from "../../src/worker/hash";
import { hostAllowed, proxySigMessage, resolveClient } from "../../src/worker/origin";
import { allow, resetRateLimits } from "../../src/worker/ratelimit";
import { addDays, daysBetween, localDay, localHour } from "../../src/worker/time";
import { parseUA } from "../../src/worker/ua";

const site: Site = {
  id: "abc123",
  account_id: 1,
  name: "Example",
  domains: ["example.com", "*.example.org"],
  timezone: "UTC",
  public: false,
  server_key: "k".repeat(32),
  exclude_paths: [],
  funnel: [],
  share_nonce: "n",
  created: 0,
};

describe("time", () => {
  it("localDay: 2026-01-15T09:30Z is the 14th in Honolulu and the 15th in Auckland", () => {
    const ts = Date.parse("2026-01-15T09:30:00Z");
    expect(localDay(ts, "Pacific/Honolulu")).toBe("2026-01-14");
    expect(localDay(ts, "Pacific/Auckland")).toBe("2026-01-15");
  });
  it("23:30 local lands on that local day", () => {
    expect(localDay(Date.parse("2026-01-15T09:30:00Z"), "Pacific/Honolulu")).toBe("2026-01-14"); // 23:30 HST
    expect(localDay(Date.parse("2026-01-15T10:30:00Z"), "Pacific/Auckland")).toBe("2026-01-15"); // 23:30 NZDT
  });
  it("localDay across DST (America/New_York 2026-03-08)", () => {
    expect(localDay(Date.parse("2026-03-09T03:59:00Z"), "America/New_York")).toBe("2026-03-08");
    expect(localDay(Date.parse("2026-03-09T04:01:00Z"), "America/New_York")).toBe("2026-03-09");
    expect(localHour(Date.parse("2026-03-08T07:30:00Z"), "America/New_York")).toBe(3);
  });
  it("addDays and daysBetween", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("hash", () => {
  it("visitorHash is 16 hex and stable", async () => {
    const a = await visitorHash("salt", "abc", "1.2.3.4", "ua");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await visitorHash("salt", "abc", "1.2.3.4", "ua")).toBe(a);
  });
  it("differs by site and by salt", async () => {
    const a = await visitorHash("salt", "abc", "1.2.3.4", "ua");
    expect(await visitorHash("salt", "xyz", "1.2.3.4", "ua")).not.toBe(a);
    expect(await visitorHash("salt2", "abc", "1.2.3.4", "ua")).not.toBe(a);
  });
  it("getSalt returns the same salt twice for a day", async () => {
    clearSaltCache();
    const a = await getSalt(env.DB, "2026-01-01");
    clearSaltCache();
    expect(await getSalt(env.DB, "2026-01-01")).toBe(a);
    expect(await getSalt(env.DB, "2026-01-02")).not.toBe(a);
  });
  it("randomId is base62 of the right length", () => expect(randomId(32)).toMatch(/^[0-9A-Za-z]{32}$/));
});

describe("ua", () => {
  const cases: [string, string, string, string][] = [
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "mobile", "Safari", "iOS"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "tablet", "Safari", "iOS"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36", "mobile", "Chrome", "Android"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0", "desktop", "Edge", "Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:143.0) Gecko/20100101 Firefox/143.0", "desktop", "Firefox", "macOS"],
    ["Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36", "mobile", "Samsung Internet", "Android"],
  ];
  for (const [ua, device, browser, os] of cases) {
    it(`${browser} on ${os} (${device})`, () => expect(parseUA(ua)).toEqual({ device, browser, os }));
  }
});

describe("ratelimit", () => {
  beforeEach(() => resetRateLimits());
  it("301st event in a minute refused", () => {
    const t = 1_000_000_000_000;
    expect(allow("s", "v", 300, t)).toBe(300);
    expect(allow("s", "v", 1, t + 1000)).toBe(0);
  });
  it("partial allowance", () => {
    const t = 1_000_000_020_000;
    expect(allow("s", "v", 290, t)).toBe(290);
    expect(allow("s", "v", 20, t)).toBe(10);
  });
  it("next minute resets", () => {
    const t = 1_000_000_000_000;
    allow("s", "v", 300, t);
    expect(allow("s", "v", 5, t + 60_000)).toBe(5);
  });
});

describe("origin", () => {
  const req = (h: Record<string, string>) => new Request("https://lf.test/e", { method: "POST", headers: h });
  const now = 1_800_000_000;

  it("www not implied by apex", () => expect(hostAllowed("www.example.com", site.domains)).toBe(false));
  it("*.example.org matches a.example.org, not example.org", () => {
    expect(hostAllowed("a.example.org", site.domains)).toBe(true);
    expect(hostAllowed("example.org", site.domains)).toBe(false);
    expect(hostAllowed("badexample.org", site.domains)).toBe(false);
  });
  it("port ignored", async () => expect(await resolveClient(req({ origin: "https://example.com:8443" }), site, now)).not.toBeNull());
  it("null origin rejected", async () => expect(await resolveClient(req({ origin: "null" }), site, now)).toBeNull());
  it("missing origin rejected", async () => expect(await resolveClient(req({}), site, now)).toBeNull());

  const signed = async (over: Record<string, string> = {}, ts = now) => {
    const h = { "x-lf-ts": String(ts), "x-lf-origin": "https://example.com", "x-lf-ip": "9.9.9.9", "x-lf-ua": "UA" };
    const sig = await hmacHex(site.server_key, proxySigMessage(h["x-lf-ts"], h["x-lf-origin"], h["x-lf-ip"], h["x-lf-ua"]));
    return { ...h, "x-lf-sig": sig, ...over };
  };
  it("valid proxy sig accepted", async () => {
    const c = await resolveClient(req(await signed()), site, now);
    expect(c).toEqual({ ip: "9.9.9.9", ua: "UA", origin: "https://example.com", proxied: true });
  });
  it("stale ts (301 s) rejected", async () => expect(await resolveClient(req(await signed({}, now - 301)), site, now)).toBeNull());
  it("tampered ip rejected", async () => expect(await resolveClient(req(await signed({ "x-lf-ip": "1.1.1.1" })), site, now)).toBeNull());
  it("signed but foreign origin rejected", async () => {
    const h = { "x-lf-ts": String(now), "x-lf-origin": "https://evil.com", "x-lf-ip": "9.9.9.9", "x-lf-ua": "UA" };
    const sig = await hmacHex(site.server_key, proxySigMessage(h["x-lf-ts"], h["x-lf-origin"], h["x-lf-ip"], h["x-lf-ua"]));
    expect(await resolveClient(req({ ...h, "x-lf-sig": sig }), site, now)).toBeNull();
  });
});
