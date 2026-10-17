import type { NextResponse } from "next/server.js";
/** Logs known crawlers and AI agents, then lets every request through. */
export declare function proxy(req: Request): NextResponse;
export { proxy as middleware };
