import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const distDir = new URL("../dist", import.meta.url);

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

const shared = {
  bundle: true,
  format: "iife",
  legalComments: "none",
  minify: false,
  platform: "browser",
  sourcemap: true,
  target: "chrome114",
  tsconfig: new URL("../tsconfig.json", import.meta.url).pathname
};

await build({
  ...shared,
  entryPoints: [new URL("../src/chatgpt_content_script.ts", import.meta.url).pathname],
  outfile: new URL("../dist/chatgpt_content_script.js", import.meta.url).pathname
});

await build({
  ...shared,
  entryPoints: [new URL("../src/service_worker.ts", import.meta.url).pathname],
  outfile: new URL("../dist/service_worker.js", import.meta.url).pathname
});

await cp(new URL("../manifest.json", import.meta.url), new URL("../dist/manifest.json", import.meta.url));
await cp(new URL("../README.md", import.meta.url), new URL("../dist/README.md", import.meta.url));
