# ChatGPT Tool Shim: Project Plan With README And Plan Docs

## Summary

Build `chatgpt-tool-shim` as a Manifest V3 Chrome/Edge extension that gives `chatgpt.com` a client-side pseudo-tool runtime by watching assistant output for structured `<tool_call>` blocks, executing allowlisted read-only tools through the extension, and injecting `<tool_result>` blocks back into the conversation.

This project includes documentation as a first-class deliverable:

- a comprehensive root `README.md`
- a checked-in implementation plan under `docs/plans/`
- a README reference to that plan so the repo has one obvious entrypoint and one obvious execution spec

The implementation remains a two-phase roadmap:

1. Phase 1: extension-only runtime
2. Phase 2: optional localhost bridge

## Implementation Changes

### Repository structure

- `README.md`
- `manifest.json`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `docs/plans/chatgpt-tool-shim-project-plan.md`
- `src/chatgpt_content_script.ts`
- `src/service_worker.ts`
- `src/protocol/`
- `src/tools/`
- `src/injected/`
- `src/ui/`
- `src/storage/`

### Phase 1 runtime

- Inject a content script into `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Mount a small overlay with runtime status and controls.
- Watch assistant output with `MutationObserver`.
- Detect only complete top-level `<tool_call>` tags.
- Ignore fenced code blocks by default.
- Deduplicate repeated detections caused by streaming or mutation churn.
- Send validated requests to the service worker.
- Inject normalized `<tool_result>` blocks into the ChatGPT composer.
- Optionally submit based on settings.

### Service worker and tool broker

- Receive tool requests from the ChatGPT content script.
- Validate schema and args.
- Enforce tool allowlist and mode.
- Dispatch to internal handlers.
- Call Chrome APIs for tabs and script injection.
- Return normalized results or errors.
- Store settings and audit entries in `chrome.storage.local`.

Execution policy defaults:

- `clock.now`: auto
- `browser.tabs.list`: auto
- `browser.tab.metadata`: auto
- `browser.tab.links`: auto
- `browser.tab.read_text`: confirm

### Protocol and data model

Canonical tool call:

```xml
<tool_call name="browser.tabs.list" id="abc123">
{}
</tool_call>
```

Canonical result:

```xml
<tool_result name="browser.tabs.list" id="abc123">
{
  "ok": true,
  "tabs": []
}
</tool_result>
```

Core types:

```ts
type ToolRequest = {
  id: string;
  name: string;
  args: unknown;
  source: {
    chatTabId: number;
    chatUrl: string;
    assistantMessageKey: string;
  };
};

type ToolResult = {
  id: string;
  name: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
};

type ToolPolicy = {
  mode: "auto" | "confirm" | "deny";
  risk: "none" | "read" | "read_page_content";
};
```

Generate a call ID when the model omits one. Preserve it when present.

### Initial tools

1. `clock.now`
2. `browser.tabs.list`
3. `browser.tab.metadata`
4. `browser.tab.links`
5. `browser.tab.read_text`

### Security defaults

- Read-only scope only.
- `browser.tab.read_text` always requires confirmation.
- Overlay shows exact target tab before confirmation.
- Audit log records timestamp, tool name, summarized args, target tab, and outcome.
- Page content returned to ChatGPT is wrapped as untrusted data.
- Only assistant-origin tool calls are executable.
- Sensitive-domain deny/block list enabled by default for `read_text`.
- Auto-submit off by default.

### Phase 2 localhost bridge

- Service worker can call a localhost HTTP endpoint.
- New tool family `local.mcp.call`.
- Explicit settings gate and visible overlay state.
- Disabled by default.
- Failures returned as normal tool errors.

HTTP is the default first bridge protocol because it is easiest to debug and manually test.

## Public Interfaces

### Manifest

- `permissions`: `tabs`, `scripting`, `storage`, `activeTab`
- `host_permissions`: `https://chatgpt.com/*`, `https://chat.openai.com/*`, `<all_urls>`
- background service worker
- ChatGPT content script
- extension action

### Content-script modules

- `ui/selectors.ts`
- `protocol/parse_tool_calls.ts`
- `ui/composer.ts`
- `ui/overlay.ts`

### Service-worker modules

- `protocol/validate.ts`
- `tools/index.ts`
- `storage/settings.ts`
- `storage/audit_log.ts`

## Milestones

1. Scaffold MV3 extension and build pipeline.
2. Add root README with overview, architecture, setup, safety model, protocol examples, roadmap, and plan link.
3. Add `docs/plans/chatgpt-tool-shim-project-plan.md`.
4. Load unpacked extension and verify content script -> service worker ping.
5. Mount overlay on ChatGPT.
6. Detect hardcoded `clock.now` tool calls.
7. Execute `clock.now` and insert tool result into composer.
8. Add auto-submit setting.
9. Implement `browser.tabs.list`.
10. Implement `browser.tab.metadata`.
11. Implement `browser.tab.links`.
12. Implement `browser.tab.read_text` with confirmation.
13. Add audit log and persisted settings.
14. Refine selectors, dedupe behavior, and manual debugging affordances.
15. Add optional localhost bridge.

## Test Plan

Automated tests for pure logic:

- parser accepts valid `<tool_call>` blocks
- parser rejects malformed or incomplete calls
- parser ignores fenced code-block examples
- deduper suppresses repeated detections
- formatter emits valid `<tool_result>` payloads
- validators reject unknown tools and invalid args

Manual verification:

1. Load unpacked extension and confirm overlay appears on ChatGPT.
2. Prime ChatGPT with the protocol instructions and verify `clock.now` executes once.
3. Verify insert-only behavior with auto-submit disabled.
4. Verify insert-and-submit behavior with auto-submit enabled.
5. Verify `browser.tabs.list` returns current-window tabs.
6. Verify `browser.tab.metadata` returns expected values.
7. Verify `browser.tab.links` returns bounded link output.
8. Verify `browser.tab.read_text` prompts before execution.
9. Verify sensitive or denied tabs cannot be read.
10. Verify malformed tool calls produce visible non-executing errors.
11. Verify audit log records success and failure.
12. Phase 2 only: verify localhost disabled/enabled/failure behavior.

## Assumptions And Defaults

- ChatGPT is the only target in the first implementation.
- The project includes both code and project documentation as core deliverables.
- The parser protocol uses `<tool_call>` and `<tool_result>`, not `<client mcp="...">`.
- TypeScript with a simple MV3-friendly build is the default implementation choice.
- Manual browser testing is the primary acceptance path.
- Auto-submit remains off by default even after it exists.
- The localhost bridge is part of the roadmap, not a Phase 1 dependency.
