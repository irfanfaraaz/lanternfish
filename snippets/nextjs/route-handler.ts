// Without proxy.ts, add this one line to a route handler such as
// app/llms.txt/route.ts to log agent fetches of that file.
// (With proxy.ts in place you don't need it: the proxy already sees every path.)
import { after } from "next/server";
import { sendAgent } from "@/lib/lanternfish";

export async function GET(req: Request) {
  after(() => sendAgent(new URL(req.url).pathname, req.headers.get("user-agent") ?? ""));
  return new Response("# llms.txt\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
