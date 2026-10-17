// A ready-made proxy (Next 16) or middleware (Next 15) that logs AI agents and crawlers.
import { NextResponse } from "next/server.js";
import { logAgent } from "./index";

export function proxy(req: Request): NextResponse {
  logAgent(req);
  return NextResponse.next();
}

export { proxy as middleware };
