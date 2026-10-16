// One-time setup after cloning: deploys the Worker (which provisions D1),
// applies migrations and sets the two secrets. Run with `bun run setup`.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/worker/auth";

function wrangler(args: string[], input?: string): { ok: boolean; out: string } {
  const r = spawnSync("bunx", ["wrangler", ...args], { input, encoding: "utf8", stdio: [input === undefined ? "inherit" : "pipe", "pipe", "inherit"] });
  const out = r.stdout ?? "";
  if (input === undefined) process.stdout.write(out);
  return { ok: r.status === 0, out };
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

/** Reads a line from the terminal without echoing it. */
async function readHidden(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  if (!stdin.isTTY) return (await new Response(Bun.stdin.stream()).text()).split(/\r?\n/)[0] ?? "";
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

console.log("Lanternfish setup\n");

if (!wrangler(["whoami"]).ok) fail("Log in first: bunx wrangler login");

const pw = await readHidden("Owner password (at least 12 characters): ");
if (pw.length < 12) fail("Use a password of at least 12 characters.");
const again = await readHidden("Again: ");
if (again !== pw) fail("The passwords don't match.");

console.log("\n→ Building and deploying (this creates the D1 database on first run)…");
if (spawnSync("bun", ["run", "build"], { stdio: "inherit" }).status !== 0) fail("Build failed.");
const deploy = wrangler(["deploy"]);
if (!deploy.ok) fail("Deploy failed. See the output above.");

console.log("\n→ Applying database migrations…");
if (!wrangler(["d1", "migrations", "apply", "lanternfish", "--remote"], "y\n").ok) fail("Migrations failed.");

console.log("\n→ Setting secrets…");
if (!wrangler(["secret", "put", "OWNER_PASSWORD_HASH"], await hashPassword(pw)).ok) fail("Couldn't set OWNER_PASSWORD_HASH.");
if (!wrangler(["secret", "put", "SESSION_SECRET"], randomBytes(32).toString("hex")).ok) fail("Couldn't set SESSION_SECRET.");

const url = /https:\/\/[^\s]+\.workers\.dev/.exec(deploy.out)?.[0];
console.log(`\n✓ Done. Open ${url ?? "your Worker's URL"} and sign in.`);
