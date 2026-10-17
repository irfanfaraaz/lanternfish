// Builds packages/next (lanternfish-next) into packages/next/dist.
// The Next.js helpers and bot list are bundled in from the repo, so the package has one source of truth.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const pkg = "packages/next";
await rm(`${pkg}/dist`, { recursive: true, force: true });
await build({
  entryPoints: [`${pkg}/src/index.ts`, `${pkg}/src/proxy.ts`],
  outdir: `${pkg}/dist`,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["next", "next/*", "react"],
  logLevel: "warning",
});
await mkdir(`${pkg}/dist`, { recursive: true });
for (const f of ["index.d.ts", "proxy.d.ts"]) await copyFile(`${pkg}/src/${f}`, `${pkg}/dist/${f}`);
await copyFile("LICENSE", `${pkg}/LICENSE`);
console.log("lanternfish-next built");
