import { Hono } from "hono";
import { api } from "./api";
import { runCron } from "./cron";
import type { AppEnv, Env } from "./env";
import { handleIngest, preflight } from "./ingest";
import { publicStats } from "./public";
import { handleServerEvent } from "./server-events";

export const app = new Hono<AppEnv>();

app.options("/e", (c) => preflight(c.req.raw));
app.post("/e", (c) => handleIngest(c.req.raw, c.env, c.executionCtx));
app.post("/s", (c) => handleServerEvent(c.req.raw, c.env, c.executionCtx));
app.get("/p/:site", (c) => publicStats(c.req.raw, c.env, c.req.param("site"), Date.now(), c.executionCtx));
app.route("/api", api);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
// Everything else is the dashboard (normally served by assets before the Worker runs).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCron(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
