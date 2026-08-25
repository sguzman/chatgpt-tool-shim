# Tool Result Transport

## Problem

The original proof-of-concept returned tool output by inserting or manually pasting text into the ChatGPT conversation. That works for tiny results but becomes unusable for source files, logs, directory trees, datasets, screenshots, binary data, or multi-file output.

The restart formalizes two result transport modes:

1. **inline result** for small textual payloads;
2. **attachment result** for large, binary, or file-native payloads.

## Correlation

Every result is tied to a `call_id`. The same ID should appear in:

- the assistant `<tool_call>`;
- the extension execution state;
- broker trace/audit data;
- result envelope;
- attachment filename where practical;
- the model-visible result reference.

The current `local.mcp.call` transport propagates the ChatGPT call ID into the broker request body and `x-chat-shim-call-id` header.

## Inline result

Use the existing form for compact results:

```xml
<tool_result name="git.status" id="call_a831d2">
{
  "ok": true,
  "branch": "main",
  "dirty": false
}
</tool_result>
```

Current default heuristic:

- textual/JSON;
- serialized result below 16 KiB;
- attachment mode enabled;
- successful results only move to attachment mode.

The threshold is a setting, not a protocol guarantee.

## Attachment result — MVP

For larger successful results, the extension serializes a JSON envelope, constructs a browser `File`, sends it through ChatGPT's file input, waits for a stable attachment-ready condition, and only then inserts the model-visible reference.

Example filename:

```text
tool-result--filesystem.read_text--call_a831d2.json
```

Model-visible reference:

```xml
<tool_result_ref
  id="call_a831d2"
  name="filesystem.read_text"
  attachment="tool-result--filesystem.read_text--call_a831d2.json"
/>
```

The **currently implemented** JSON envelope is deliberately small:

```json
{
  "protocol": "chat-shim-tool-result/v1",
  "call_id": "call_a831d2",
  "tool": "filesystem.read_text",
  "ok": true,
  "result": {
    "text": "..."
  }
}
```

Errors remain inline so attachment-delivery failure cannot recursively require another attachment.

## Future attachment metadata

Once the basic upload path is verified, the envelope can grow without changing the correlation model. Candidate fields include:

```json
{
  "generated_at": "2026-08-22T00:00:00Z",
  "content_type": "text/plain; charset=utf-8",
  "bytes": 12345,
  "sha256": "...",
  "provenance": {
    "provider": "native.filesystem",
    "resource": "project:chatgpt-tool-shim/src/service_worker.ts"
  }
}
```

For native binary results, preserve the useful file extension and use a sidecar metadata JSON if needed. Binary/file-native transport is planned but not yet implemented by the current JSON-only packager.

## Result mode decision

Attachment transport should eventually be preferred when any of these are true:

- payload is above the inline threshold;
- payload is binary;
- the native file representation is valuable;
- result contains multiple files;
- result would make the chat message unwieldy;
- the broker explicitly requests attachment mode.

The current MVP implements the first condition for successful JSON-serializable results.

## Extension state machine

A tool call moves through explicit traced states rather than an opaque chain of DOM callbacks:

```text
DETECTED
VALIDATED
WAITING_CONFIRMATION
CONFIRMED
DISPATCHED
RESULT_RECEIVED
PACKAGING
RESULT_INLINE | ATTACHING
ATTACHMENT_READY
SUBMITTING
SUBMITTED
```

Current error/terminal trace states include:

```text
DENIED
TOOL_ERROR
DELIVERY_ERROR
```

The existing call fingerprint dedupe prevents the same streamed assistant call from being executed repeatedly after DOM mutations.

## Critical upload rule

**Never submit the result reference until ChatGPT's UI indicates that the attachment upload is complete.**

File-input mutation and upload completion are separate events. The current implementation requires the expected filename to be visible in the composer scope and requires loading/progress indicators to remain absent for several consecutive polls before `ATTACHMENT_READY` resolves.

This heuristic is intentionally conservative and must be revalidated against the current ChatGPT DOM.

## Batch/multiple results

Do not begin with parallel model-requested calls. First make one-call-at-a-time correlation reliable.

The protocol still permits future batching by giving every call its own ID and every attachment its own metadata.

## Failure reporting

If attachment upload fails, do not silently fall back to a huge inline payload. Return a compact `RESULT_DELIVERY_ERROR` result and retain the local call trace for the diagnostics export.
