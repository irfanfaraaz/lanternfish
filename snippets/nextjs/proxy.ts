// Records crawler and AI-agent fetches in Lanternfish. Copy to proxy.ts at the
// project root (Next 16's middleware). It only runs for known bot user agents,
// and after() sends the event once the response is on its way.
// If you already have a proxy.ts, call sendAgent() from it the same way.
import { after, type NextRequest, NextResponse } from "next/server";
import { sendAgent } from "@/lib/lanternfish";

export function proxy(req: NextRequest) {
  after(() => sendAgent(req.nextUrl.pathname, req.headers.get("user-agent") ?? ""));
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      has: [
        {
          type: "header",
          key: "user-agent",
          value:
            ".*(OAI-SearchBot|oai-searchbot|ChatGPT-User|chatgpt-user|GPTBot|gptbot|Claude-SearchBot|claude-searchbot|Claude-User|claude-user|ClaudeBot|claudebot|Perplexity-User|perplexity-user|PerplexityBot|perplexitybot|Google-Extended|google-extended|Googlebot|googlebot|Bingbot|bingbot|Applebot|applebot|DuckAssistBot|duckassistbot|Meta-ExternalAgent|meta-externalagent|Amazonbot|amazonbot).*",
        },
      ],
    },
  ],
};
