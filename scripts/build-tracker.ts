// Builds src/tracker/lf.ts into dist/public/lf.js and fails if it grows past 2 KB gzipped.
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const LIMIT = 2048;

const out = await build({
  entryPoints: ["src/tracker/lf.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  write: false,
  legalComments: "none",
});
const code = out.outputFiles[0]!.text;
const gz = gzipSync(code, { level: 9 }).length;

mkdirSync("dist/public", { recursive: true });
writeFileSync("dist/public/lf.js", code);
writeFileSync(
  "dist/public/_headers",
  [
    "/lf.js",
    "  Cache-Control: public, max-age=86400",
    "  Access-Control-Allow-Origin: *",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n"),
);

console.log(`lf.js: ${code.length} bytes, ${gz} bytes gzipped (limit ${LIMIT})`);
if (gz >= LIMIT) {
  console.error("lf.js is over the 2 KB gzipped budget");
  process.exit(1);
}
