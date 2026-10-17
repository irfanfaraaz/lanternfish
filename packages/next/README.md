# lanternfish-next

[Lanternfish](https://github.com/irfanfaraaz/lanternfish) for Next.js (App Router, Next 15.1 or later). It does three jobs:

- adds the tracker to every page;
- sends events through your own domain, so ad blockers see a first-party request;
- logs AI agents and crawlers (GPTBot, ClaudeBot, PerplexityBot and others), which never run JavaScript.

You don't need this package to use Lanternfish: one script tag counts visits on any site. Use it when you want the two extras without copying files.

## Set up

```sh
npm install lanternfish-next
```

**1. Environment variables.** Copy them from your site's Settings page in the Lanternfish dashboard:

```sh
LF_ORIGIN=https://lanternfish.you.workers.dev
LF_SITE=abc123
LF_SERVER_KEY=...
```

**2. The tracker.** In `app/layout.tsx`:

```tsx
import { Lanternfish } from "lanternfish-next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Lanternfish />
      </body>
    </html>
  );
}
```

**3. The proxy route.** Create `app/api/e/route.ts` with one line:

```ts
export { POST } from "lanternfish-next";
```

**4. AI agents (optional).** Create `proxy.ts` at the project root (`middleware.ts` on Next 15):

```ts
export { proxy } from "lanternfish-next/proxy";
export const config = { matcher: "/((?!_next/|favicon.ico).*)" };
```

On Next 15, export `middleware` instead of `proxy`. Next.js needs `config` written out in this file, so it can't come from the package. For people it does one user-agent check and lets the request through.

Already have a proxy or middleware? Call `logAgent(req)` from it instead:

```ts
import { logAgent } from "lanternfish-next";

export function proxy(req: NextRequest) {
  logAgent(req);
  // ...your own logic
}
```

## Options

`<Lanternfish />` reads `LF_ORIGIN` and `LF_SITE`, and renders nothing until both are set. Props override them:

| Prop | Default |
|---|---|
| `origin` | `LF_ORIGIN` |
| `site` | `LF_SITE` |
| `api` | `"/api/e"` when `LF_SERVER_KEY` is set, otherwise events go straight to the Worker. `false` never proxies. |

Without `LF_SERVER_KEY` the route and agent logging do nothing, and the tracker talks to the Worker directly.

## Licence

AGPL-3.0-only.
