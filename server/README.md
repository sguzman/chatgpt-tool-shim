# Local Capability Broker

`server/` now contains the first localhost capability broker implementation introduced by the August 2026 restart.

See [the broker architecture document](../docs/architecture/local-capability-broker.md) and [ADR 0001](../docs/decisions/0001-server-in-monorepo-for-restart.md).

## Current MVP

The current broker is intentionally small. It proves the transport and authorization boundary before MCP registration or filesystem authority are added.

Implemented now:

- Node/TypeScript runtime bundled with esbuild;
- loopback-only binding to `127.0.0.1`;
- bearer-token authentication for capability discovery and execution;
- unauthenticated `GET /health` for diagnostics;
- `GET /v1/capabilities`;
- `POST /v1/execute`;
- compatibility `POST /tool` for the extension's existing `local.mcp.call` shape;
- correlated `call_id` propagation;
- request body size limit;
- normalized JSON errors;
- in-process capability registry;
- `broker.hello`, `broker.clock`, and `system.runtime` starter capabilities.

## Build and run

From the repository root:

```powershell
npm install
npm run build:server
npm run server:start
```

The broker listens on:

```text
http://127.0.0.1:3210
```

If `CHATGPT_TOOL_SHIM_TOKEN` is not set, startup generates an **ephemeral random token** and prints it to the terminal. Copy that token into the extension's **Configure Broker** control and keep the default execute URL:

```text
http://127.0.0.1:3210/tool
```

For a stable token across restarts, set it before starting the broker:

```powershell
$env:CHATGPT_TOOL_SHIM_TOKEN = "replace-with-a-long-random-secret"
npm run server:start
```

The token is stored only in extension local settings and is deliberately omitted from extension diagnostic exports.

## HTTP examples

Health does not require authentication:

```powershell
Invoke-RestMethod http://127.0.0.1:3210/health
```

Capability discovery requires the token:

```powershell
$headers = @{ Authorization = "Bearer $env:CHATGPT_TOOL_SHIM_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3210/v1/capabilities -Headers $headers
```

Execute a harmless capability:

```powershell
$body = @{ tool = "broker.hello"; args = @{} } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3210/v1/execute -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

## Extension smoke test

After loading the unpacked extension and configuring the broker, steer ChatGPT to emit:

```xml
<tool_call name="local.mcp.call">
{
  "tool": "broker.hello",
  "args": {}
}
</tool_call>
```

The extension should ask for confirmation, send the authenticated request to the broker, and return the broker result to ChatGPT without manual copying.

## Component contract

The server remains responsible for:

- authenticated loopback transport;
- provider/MCP registration and lifecycle;
- normalized capability registry;
- progressive ontology/search;
- resource registration and resolution;
- capability/resource policy evaluation;
- execution routing;
- audit/provenance;
- result serialization/attachment descriptors;
- redacted diagnostics.

The browser extension is responsible for ChatGPT-specific DOM integration and presentation. The server must not depend on ChatGPT selectors, page markup, upload DOM, or send-button behavior.

## Next server work

Do **not** add broad filesystem access yet. First verify the complete `local.mcp.call -> broker.hello -> automatic result return` loop and collect a debug bundle. Then add broker tracing, capability search/ontology, and narrow resource-scoped providers.
