# Local Capability Broker

## Purpose

The local capability broker is the server-side component of the restarted project. It turns a browser-extension transport into a general local capability system.

The broker should answer four different questions separately:

1. **What providers and tools exist?**
2. **How are those capabilities described and discovered?**
3. **Which resources and operations is this session allowed to access?**
4. **How is a requested operation executed, traced, and returned?**

Keeping those concerns separate is the core architectural requirement.

## Initial location

The broker lives under `server/` in this repository during the restart. See ADR 0001.

The directory is a component boundary, not an invitation to mix browser code and server code. The extension and broker should communicate only through a versioned local protocol.

## Responsibilities

### Transport

- bind only to loopback by default;
- authenticate extension requests with a per-install secret;
- expose a versioned HTTP API first because it is easy to inspect and debug;
- preserve a path to Native Messaging or another transport later.

### Provider registry

A provider is a source of capabilities. Initial provider types may include:

- native broker tools;
- MCP stdio servers;
- MCP HTTP/stream transports;
- filesystem adapters;
- process/system adapters;
- application-specific adapters.

Each provider receives a stable provider ID and lifecycle state.

### Capability registry

Normalize provider-specific tool descriptions into a broker record such as:

```json
{
  "id": "filesystem.read_text",
  "provider": "native.filesystem",
  "kind": "tool",
  "namespace": "filesystem",
  "description": "Read UTF-8 text from an authorized file",
  "input_schema": {},
  "risk": "read",
  "ontology": ["computer", "filesystem", "read"]
}
```

Registration means the capability exists. It does not mean the current ChatGPT session may use it.

### Ontology and progressive discovery

Capabilities should be searchable by more than exact tool name. The broker should support:

- hierarchical ontology paths;
- free-text descriptions;
- provider names;
- resource kinds;
- risk class;
- tags/aliases.

The model should be able to start broad (`computer.filesystem`) and request only the relevant leaf schemas.

### Resource model

Represent local objects independently from tools. Examples:

- a directory tree;
- a Git repository;
- a browser profile;
- a running process;
- a Blender scene;
- a named application workspace.

A resource record should have a stable ID and a human-readable locator without requiring raw paths to be the only identity mechanism.

### Capability leases / scopes

A session can receive explicit grants such as:

```text
READ   project:chatgpt-tool-shim/**
WRITE  project:chatgpt-tool-shim/docs/**
DENY   user:credentials/**
DENY   browser:cookies/**
```

The exact syntax can change. The important property is that tool support and resource authorization remain independent.

### Policy evaluation

The broker determines whether a call is:

- automatically allowed;
- confirmation-required;
- denied.

Policy inputs can include:

- tool risk;
- resource scope;
- provider trust;
- requested operation;
- current capability lease;
- call provenance;
- user-defined permanent rules.

### Execution

For every call:

1. authenticate request;
2. validate protocol and schema;
3. resolve capability;
4. resolve referenced resources;
5. evaluate policy;
6. dispatch to provider;
7. normalize result;
8. record provenance/audit data;
9. package inline or attachment result.

## Proposed HTTP surface

The first server API should remain small.

```text
GET  /health
GET  /v1/info
POST /v1/capabilities/search
GET  /v1/capabilities/{id}
POST /v1/tools/call
GET  /v1/resources
GET  /v1/resources/{id}
```

A compatibility `POST /tool` endpoint may map the current `local.mcp.call` shape into `/v1/tools/call` while the extension migrates.

## Minimal request envelope

```json
{
  "protocol": "chatgpt-tool-shim/1",
  "call_id": "call_a831d2",
  "conversation": {
    "adapter": "chatgpt-web",
    "conversation_id": "optional-local-id"
  },
  "tool": "filesystem.read_text",
  "arguments": {
    "resource": "project:chatgpt-tool-shim/README.md"
  }
}
```

## Minimal response envelope

```json
{
  "protocol": "chatgpt-tool-shim/1",
  "call_id": "call_a831d2",
  "tool": "filesystem.read_text",
  "ok": true,
  "result": {},
  "provenance": {
    "provider": "native.filesystem"
  }
}
```

Large results can return a broker-side result descriptor that the extension turns into a ChatGPT attachment.

## Configuration direction

Configuration should eventually separate:

- server transport/auth settings;
- provider definitions;
- ontology aliases;
- resource definitions;
- policy defaults;
- persistent grants.

Do not store secrets in committed configuration.

## Language choice

The architecture is intentionally language-neutral. The first broker implementation may use TypeScript to share types and maximize iteration speed with the extension. A later move to Rust is compatible if the broker boundary remains an HTTP/protocol contract rather than shared runtime internals.

The language should not be allowed to determine the security model.

## Definition of MVP

The broker MVP is complete when:

- it starts locally and exposes `/health`;
- the extension authenticates to it;
- it advertises at least one capability;
- a ChatGPT-originated tool call reaches that capability;
- the broker records a trace;
- the result returns to ChatGPT without manual copying;
- unauthorized resource access is rejected.
