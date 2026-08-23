import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";

const distDir = new URL("../server/dist", import.meta.url);
await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [new URL("../server/src/index.ts", import.meta.url).pathname],
  outfile: new URL("../server/dist/server.js", import.meta.url).pathname,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  legalComments: "none"
});
