# ChatGPT Tool Shim

ChatGPT Tool Shim is a Chrome/Edge extension plus a localhost capability broker that lets hosted ChatGPT participate in a client-side tool loop without pretending those tools exist inside OpenAI's backend.

The extension watches visible assistant output for structured `<tool_call>` blocks, validates and dispatches them, and returns results to the ChatGPT page. The restarted architecture makes the extension a thin ChatGPT adapter while the local broker owns capability registration, future MCP integration, resource boundaries, permissions, execution, provenance, and result packaging.

## Project Restart — August 2026

The project is active again.

The restart branch now contains:

- the original extension tool loop and browser tools;
- hardened current-UI selector logic and structured diagnostics export;
- automatic inline-vs-attachment result packaging;
- a conservative attachment-ready gate before auto-submit;
- an authenticated loopback capability broker under `server/`;
- a broker configuration control in the extension overlay;
- correlated call IDs across ChatGPT, extension, and broker;
- checkbox milestone files and architecture decisions;
- a Windows debug-bundle collector for sharing reproducible failures.

Start here:

- [Documentation index](docs/README.md)
- [System overview](docs/architecture/system-overview.md)
- [Local capability broker](docs/architecture/local-capability-broker.md)
- [Repository boundary decision](docs/decisions/0001-server-in-monorepo-for-restart.md)
- [Milestone tracker](docs/milestones/README.md)
- [Tool result transport](docs/protocol/result-transport.md)
- [Debug bundle specification](docs/debug/debug-bundle.md)
- [Extension diagnostics](docs/debug/extension-diagnostics.md)
- [Server component](server/README.md)

The original implementation plan remains at [docs/plans/chatgpt-tool-shim-project-plan.md](docs/plans/chatgpt-tool-shim-project-plan.md) as a record of the first build. The milestone tracker is the canonical restart plan.

## Architecture

```text
ChatGPT web UI
    |
    | visible <tool_call>
    v
ChatGPT extension adapter
    |  - DOM observation
    |  - call correlation / dedupe
    |  - confirmation UI
    |  - inline or attachment result delivery
    v
Local capability broker
    |  - loopback authentication
    |  - capability registry
    |  - future MCP/provider registry
    |  - capability ontology
    |  - resource boundaries / leases
    |  - policy evaluation
    |  - execution + provenance
    |  - result packaging
    +---- native local tools
    +---- future MCP servers
    +---- future filesystem / process / application adapters
```

The extension should remain intentionally thin. ChatGPT-specific DOM breakage should not be able to invalidate the capability model or server architecture.

## Quick Start

Clone the restart branch and build both components:

```powershell
git clone --branch restart/local-capability-broker --single-branch https://github.com/sguzman/chatgpt-tool-shim.git
cd chatgpt-tool-shim
npm install
npm test
npm run build
```

Load `dist/` as an unpacked extension from `edge://extensions` or `chrome://extensions`.

For normal restart-branch iteration, use this single full refresh command from the repository root:

```powershell
git pull --ff-only; npm test; npm run build; npm run server:start
```

This intentionally refreshes and validates both the extension and broker together. `npm run server:start` remains attached to the terminal; stop it with `Ctrl+C` before running the refresh sequence again.

If `CHATGPT_TOOL_SHIM_TOKEN` is not already set, the broker prints an ephemeral random token. In the ChatGPT overlay click **Configure Broker**, keep:

```text
http://127.0.0.1:3210/tool
```

and paste the token.

Then smoke-test the full local round trip with:

```xml
<tool_call name="local.mcp.call">
{
  "tool": "broker.hello",
  "args": {}
}
</tool_call>
```

The extension should ask for confirmation, execute the broker call, and return the result without manual copying.

## Result Transport

Small results stay inline as `<tool_result>`.

Large successful results are packaged as JSON attachments with correlated filenames such as:

```text
tool-result--filesystem.read_text--call_a831d2.json
```

After ChatGPT's attachment UI reaches a stable ready state, the extension inserts a small reference:

```xml
<tool_result_ref id="call_a831d2" name="filesystem.read_text" attachment="tool-result--filesystem.read_text--call_a831d2.json" />
```

Auto-submit never runs before that readiness gate resolves.

## Current Tools

Extension-native tools:

- `hello`
- `clock`
- `clock.now`
- `browser.tabs.list`
- `browser.tab.metadata`
- `browser.tab.links`
- `browser.tab.read_text`
- `local.mcp.call`

Broker-native MVP capabilities:

- `broker.hello`
- `broker.clock`
- `broker.large_result`
- `system.runtime`

MCP registration, ontology search, and resource-scoped filesystem/application providers come after the basic round trip is verified locally.

## Diagnostics

The overlay has **Download Diagnostics**. The export includes structural selector information, non-secret settings, audit entries, and correlated delivery states without exporting page text or the broker token.

Put that JSON into `debug-input/`, then run:

```powershell
npm run debug:bundle
```

The ZIP is written under `debug-bundles/` and includes git state, runtime versions, `npm test`, `npm run build`, broker health, and explicitly supplied diagnostic files.

## Safety Direction

The restart keeps capability and resource authorization separate:

- a tool may technically support broad operations;
- a conversation receives only explicit capability/resource scopes;
- sensitive resources remain denied even if a provider exposes them;
- localhost transport is authenticated and loopback-only;
- high-risk operations require policy approval;
- every execution should be auditable and correlated to a tool call ID.

The long-term goal is not unrestricted remote control. It is a local, inspectable capability broker with narrow, explicit authority.

## Non-goals

- pretending these are native OpenAI backend tools;
- silently exposing the whole computer;
- using the ChatGPT DOM as the source of truth for permissions;
- coupling every MCP implementation detail to the browser extension;
- loading every registered tool schema into model context at once.

## License

See [LICENSE](LICENSE).
