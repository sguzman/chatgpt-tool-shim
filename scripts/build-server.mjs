import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const distDirUrl = new URL("../server/dist", import.meta.url);
const distDir = fileURLToPath(distDirUrl);
const entryPoint = fileURLToPath(new URL("../server/src/index.ts", import.meta.url));
const outfile = fileURLToPath(new URL("../server/dist/server.js", import.meta.url));

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  legalComments: "none"
});
