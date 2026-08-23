# M3 — Local Broker MVP

## Goal

Implement the first real localhost capability broker behind the extension.

## Implementation note — 2026-08-22

The restart branch now contains a Node/TypeScript broker MVP under `server/`: loopback-only HTTP, bearer authentication, `/health`, authenticated capability discovery, `/v1/execute`, `/tool` compatibility, a capability registry, correlated call IDs, normalized errors, and starter `broker.hello`, `broker.clock`, and `system.runtime` capabilities. The extension now carries the call ID and bearer token to the broker and exposes a small **Configure Broker** control.

The first Windows runtime launch successfully started the built broker and reported `ChatGPT Tool Shim broker listening on http://127.0.0.1:3210`, confirming the packaged server starts and binds to loopback on the target machine. A generated ephemeral bearer token was also produced.

In the first live ChatGPT-originated `local.mcp.call`, the extension detected the model request and entered its explicit confirmation state, rendering **Allow localhost bridge tool execution? [local.mcp.call]** with Run/Cancel controls. This verifies the model-to-extension dispatch and the intended human authorization boundary for localhost calls. Broker execution/result return remains unchecked until the pending request is approved and completes.

## Checklist

- [x] Choose initial implementation language/runtime — Node 22 + TypeScript/esbuild.
- [x] Create server package/build scaffold under `server/`.
- [x] Bind to `127.0.0.1` only by default.
- [x] Implement authentication secret for the broker MVP.
- [x] Implement `GET /health`.
- [ ] Implement `GET /v1/info`.
- [x] Implement authenticated execution endpoint (`POST /v1/execute`).
- [x] Add compatibility handling for existing `/tool` request shape.
- [ ] Finalize versioned request/response envelopes.
- [x] Implement harmless native tools (`broker.hello`, `broker.clock`).
- [x] Implement one useful read-only local tool (`system.runtime`).
- [ ] Record timing, provider, outcome, and error in a persistent broker trace.
- [x] Reject unknown tools.
- [x] Reject malformed arguments.
- [x] Reject unauthenticated requests.
- [x] Return normalized errors.
- [x] Update extension settings/UI for broker URL, token, and configuration status.
- [ ] Add active extension broker-health indicator.
- [ ] Route one ChatGPT-originated call through the broker end-to-end.
- [ ] Return the result without manual copying in a real browser session.
- [x] Include broker health information in the debug bundle.

## Exit condition

A ChatGPT tool call reaches an authenticated local broker, executes one local capability, and returns automatically with traceable diagnostics.
