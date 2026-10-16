import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

// The dashboard builds into dist/public, which the Worker serves as static assets.
// `bun run dev` (wrangler dev) serves the API on :8787; `vite` proxies to it.
export default defineConfig({
  root: "src/dashboard",
  plugins: [preact()],
  build: {
    outDir: "../../dist/public",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    proxy: { "/api": "http://localhost:8787", "/p": "http://localhost:8787", "/lf.js": "http://localhost:8787" },
  },
});
