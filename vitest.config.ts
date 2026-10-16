import { mkdirSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Wrangler needs the assets directory to exist, even before a build.
mkdirSync("dist/public", { recursive: true });

const b64url = (b: Buffer) => b.toString("base64url");
const salt = Buffer.from("lanternfish-test-salt");
const TEST_HASH = `pbkdf2$10000$${b64url(salt)}$${b64url(pbkdf2Sync("test-password", salt, 10000, 32, "sha256"))}`;

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
          OWNER_PASSWORD_HASH: TEST_HASH,
          SESSION_SECRET: "test-secret-0123456789",
        },
      },
    })),
  ],
  test: {
    include: ["test/worker/**/*.test.ts"],
    setupFiles: ["./test/worker/setup.ts"],
  },
});
