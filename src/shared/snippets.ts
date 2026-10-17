/** Copy-paste snippets shown in the dashboard. The Next.js files live in /snippets. */

export function scriptTag(workerOrigin: string, siteId: string, proxied: boolean): string {
  const api = proxied ? ' data-api="/api/e"' : "";
  return `<script defer src="${workerOrigin}/lf.js" data-site="${siteId}"${api}></script>`;
}

export function envBlock(workerOrigin: string, siteId: string, serverKey = "<your server key>"): string {
  return [`LF_ORIGIN=${workerOrigin}`, `LF_SITE=${siteId}`, `LF_SERVER_KEY=${serverKey}`].join("\n");
}

/** The lanternfish-next setup, step by step. */
export const NEXT_PACKAGE = {
  install: "npm install lanternfish-next",
  layout: `import { Lanternfish } from "lanternfish-next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Lanternfish />
      </body>
    </html>
  );
}`,
  route: `export { POST } from "lanternfish-next";`,
  proxy: `export { proxy } from "lanternfish-next/proxy";
export const config = { matcher: "/((?!_next/|favicon.ico).*)" };`,
} as const;

export function curlServerEvent(workerOrigin: string, siteId: string): string {
  return [
    `curl -X POST ${workerOrigin}/s \\`,
    `  -H "x-lf-key: $LF_SERVER_KEY" \\`,
    `  -H "content-type: application/json" \\`,
    `  -d '{"site":"${siteId}","name":"agent","path":"/llms.txt","ua":"<the request's User-Agent>"}'`,
  ].join("\n");
}

export const GENERIC_PROXY = `Any backend can proxy the tracker so ad blockers see a first-party request:

1. Serve POST /api/e on your own domain.
2. Forward the body unchanged to <worker>/e with these headers:
   x-lf-ts       current unix time in seconds
   x-lf-origin   the browser's Origin header
   x-lf-ip       the visitor's IP (used in memory only, never stored)
   x-lf-ua       the visitor's User-Agent
   x-lf-country  optional ISO country code
   x-lf-city     optional city name
   x-lf-sig      hex HMAC-SHA256 of "ts\\norigin\\nip\\nua" keyed with the server key
3. Answer the browser with 204 straight away.`;

/** Recommended attributes, for the dashboard's "Tracking" help. */
export const ATTRIBUTES = [
  ['data-lf-section="name"', "Counts the section once per page load when half of it (or half the screen) is visible. Feeds the funnel."],
  ['data-lf-click="name"', "Sends that event when the element is clicked."],
  ['data-lf-prop-plan="pro"', "Adds a prop to the click event (up to 5)."],
  ["<html data-lf-404>", "Marks the page as a 404."],
  ['lf("signup", { plan: "pro" })', "Sends a custom event from code."],
  ["?lf=off  /  ?lf=on", "Stops or resumes tracking in your own browser."],
] as const;
