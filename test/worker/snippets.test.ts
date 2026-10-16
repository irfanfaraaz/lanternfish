import { describe, expect, it } from "vitest";
import proxySource from "../../snippets/nextjs/proxy.ts?raw";
import { proxyHeaders } from "../../snippets/nextjs/lib/lanternfish";
import { BOT_UA_REGEX_SOURCE } from "../../src/shared/bots";
import { scriptTag } from "../../src/shared/snippets";
import { resolveClient } from "../../src/worker/origin";
import { makeSite } from "./helpers";

describe("snippets", () => {
  it("the Next.js proxy route's signature verifies in the Worker", async () => {
    const site = makeSite();
    const now = Math.floor(Date.now() / 1000);
    const h = new Headers({ origin: "https://example.com", "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "Mozilla/5.0", "x-vercel-ip-country": "IN" });
    const headers = await proxyHeaders(h, site.server_key, now);
    const client = await resolveClient(new Request("https://lf.test/e", { method: "POST", headers }), site, now);
    expect(client).toEqual({ ip: "203.0.113.9", ua: "Mozilla/5.0", origin: "https://example.com", proxied: true });
  });

  it("a wrong key does not verify", async () => {
    const site = makeSite();
    const now = Math.floor(Date.now() / 1000);
    const headers = await proxyHeaders(new Headers({ origin: "https://example.com", "x-real-ip": "1.1.1.1" }), "wrong", now);
    expect(await resolveClient(new Request("https://lf.test/e", { method: "POST", headers }), site, now)).toBeNull();
  });

  it("proxy.ts matcher is the shared bot list", () => {
    expect(proxySource).toContain(`value:\n            "${BOT_UA_REGEX_SOURCE}"`);
  });

  it("script tag carries data-site, and data-api when proxied", () => {
    expect(scriptTag("https://lf.example", "abc", false)).toBe('<script defer src="https://lf.example/lf.js" data-site="abc"></script>');
    expect(scriptTag("https://lf.example", "abc", true)).toContain('data-api="/api/e"');
  });
});
