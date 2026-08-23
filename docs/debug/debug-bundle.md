# Debug Bundle Specification

## Purpose

A debug bundle is a ZIP that can be shared during development so another person or ChatGPT can inspect the state of both halves of the system without reconstructing failures from screenshots and manually copied logs.

The bundle must be useful while minimizing accidental collection of personal data.

## Current collector

On Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\debug-bundle.ps1
```

Optional broker base URL:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\debug-bundle.ps1 -BrokerUrl http://127.0.0.1:3210
```

Output goes to `debug-bundles/`.

## Bundle contents

The initial collector includes only project/debug information:

```text
bundle-manifest.json
git/
  branch.txt
  status.txt
  recent-commits.txt
  tracked-files.txt
runtime/
  versions.txt
  os.txt
checks/
  npm-test.txt
  npm-build.txt
broker/
  health.txt
project/
  manifest.json
  package.json
  tsconfig.json
  vite.config.ts
debug-input/
  ...optional explicitly supplied diagnostics...
README.txt
```

## Optional extension diagnostics

The collector copies files from `debug-input/` if that directory exists. Future extension UI should be able to export files there (or directly generate a bundle) such as:

- `extension-diagnostics.json`
- `audit-log.json`
- `tool-trace.json`
- `dom-selector-report.json`
- `attachment-state.json`
- screenshots explicitly chosen for debugging.

The collector does **not** crawl browser profiles or arbitrary user directories.

## Future broker diagnostics

The broker should support a redacted diagnostic export containing:

- broker version/build;
- active provider IDs and states;
- capability registry summary;
- policy decision trace for selected call IDs;
- recent execution timings;
- protocol errors;
- resource IDs without secret contents;
- sanitized configuration summary.

Never include authentication tokens, raw credential stores, environment secrets, cookies, or unrelated file contents.

## Privacy review before sharing

Before uploading a debug bundle, inspect it if the failure involved sensitive resources. The bundle intentionally avoids broad collection, but Git status, paths, logs, and explicitly supplied diagnostics can still reveal local names or content.

## Call-centric bundles

Long term, support:

```text
Export debug bundle for call call_a831d2
```

That should collect only the extension and broker events correlated to the selected call ID. Call-centric bundles will be much more useful than whole-session dumps once tracing is mature.

## Acceptance criteria

A debug bundle is considered useful when it lets a reviewer answer:

1. which revision was running;
2. whether tests/build passed;
3. whether the broker was reachable;
4. which tool call failed;
5. where in the extension/broker/result state machine it failed;
6. which error was returned;
7. whether retrying would risk duplicate execution.
