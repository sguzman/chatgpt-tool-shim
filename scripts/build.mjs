import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const distDirUrl = new URL("../dist", import.meta.url);
const distDir = fileURLToPath(distDirUrl);
const tsconfig = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const contentScript = fileURLToPath(new URL("../src/chatgpt_content_script.ts", import.meta.url));
const serviceWorker = fileURLToPath(new URL("../src/service_worker.ts", import.meta.url));
const contentScriptOut = fileURLToPath(new URL("../dist/chatgpt_content_script.js", import.meta.url));
const serviceWorkerOut = fileURLToPath(new URL("../dist/service_worker.js", import.meta.url));

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
  tsconfig
};

await build({
  ...shared,
  entryPoints: [contentScript],
  outfile: contentScriptOut
});

await build({
  ...shared,
  entryPoints: [serviceWorker],
  outfile: serviceWorkerOut
});

await cp(new URL("../manifest.json", import.meta.url), new URL("../dist/manifest.json", import.meta.url));
await cp(new URL("../README.md", import.meta.url), new URL("../dist/README.md", import.meta.url));
