# System Overview

## Goal

Give a hosted chat UI a controlled, inspectable path to local capabilities without requiring those capabilities to exist in the model provider's backend.

The restart separates the project into two primary runtime components:

1. a **ChatGPT adapter extension** that translates between the web UI and the local protocol;
2. a **local capability broker** that owns discovery, authorization, execution, and result packaging.

## Component boundary

```text
+-------------------------+
| ChatGPT web             |
| model-visible messages  |
+------------+------------+
             |
             | <tool_call>
             v
+-------------------------+
| Browser extension       |
| ChatGPT adapter         |
|                         |
| - observe assistant DOM |
| - parse/dedupe calls    |
| - display confirmations |
| - call localhost broker |
| - upload result files   |
| - submit result message |
+------------+------------+
             |
             | authenticated loopback protocol
             v
+-----------------------------+
| Local capability broker     |
|                             |
| - provider registry         |
| - MCP lifecycle             |
| - ontology/search           |
| - resource scopes           |
| - policy engine             |
| - execution                 |
| - audit/provenance          |
| - result serialization      |
+---+-------------+-----------+
    |             |
    v             v
 native tools    MCP servers
```

## Design principles

### 1. Keep ChatGPT-specific logic at the edge

Selectors, composer insertion, attachment upload, and send-button behavior are expected to break as the hosted UI changes. They belong in the extension adapter, not in the broker.

### 2. The broker is the authority

The extension may request an operation, but it must not decide whether a local resource is authorized. The broker evaluates provider availability, capability policy, resource scope, and call identity.

### 3. Registration is not authorization

A registered tool describes what a provider can do. A capability grant describes what this ChatGPT session may do. Those are deliberately separate concepts.

### 4. Capability discovery must be progressive

The system should not inject every MCP schema into every conversation. A small stable meta-interface lets the model search and inspect relevant capability slices on demand.

Candidate meta-tools:

- `capabilities.search`
- `capabilities.describe`
- `resources.list`
- `resources.describe`
- `tool.call`

Direct named-tool calls can remain supported for compact, stable tool sets.

### 5. Results are transport objects

Small textual results can be returned inline. Large, binary, or multi-file results should be packaged as attachments with a small correlated reference message. See `docs/protocol/result-transport.md`.

### 6. Every call is correlated

A call ID follows the request through:

- assistant request;
- extension state machine;
- broker trace;
- provider invocation;
- result envelope;
- attachment name;
- result message;
- audit log.

## Trust boundaries

### Hosted page

Untrusted as an authorization source. DOM contents can trigger parsing, but cannot grant access to local resources.

### Extension

Trusted transport/UI adapter, but not the final policy authority.

### Local broker

Primary trust boundary. It holds the local authentication secret, evaluates scopes, and executes providers.

### Providers / MCP servers

Individually registered. Their advertised tools are normalized into broker capability records. Provider claims do not automatically bypass broker policy.

## Immediate restart sequence

1. Revalidate the current extension against the current ChatGPT DOM.
2. Replace manual/pasted large result return with attachment transport.
3. Implement a minimal authenticated broker with health, capability listing, and one local tool.
4. Route `local.mcp.call` through the broker contract.
5. Add MCP provider registration and progressive ontology discovery.
6. Add conversation/resource scoped authorization.
