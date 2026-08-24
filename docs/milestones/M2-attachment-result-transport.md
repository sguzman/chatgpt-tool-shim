# M2 — Attachment Result Transport

## Goal

Replace huge/manual result messages with reliable attachment delivery for large or file-native tool output.

## Implementation note — 2026-08-23

The restart branch has an initial implementation for size-based routing, versioned JSON result envelopes, correlated filenames and `<tool_result_ref>` messages, synthetic `File` upload through ChatGPT's file input, a conservative attachment-ready wait, delivery-state tracing, and compact delivery errors.

A bounded `broker.large_result` capability provides a deterministic attachment-test payload without exposing filesystem resources. It defaults to 64 KiB, accepts an explicit integer byte count, and rejects requests above 2 MiB. Unit coverage verifies the default, explicit sizes, and rejection bounds.

The first live Edge attachment run succeeded for a 65,536-byte broker payload. After the user approved the `local.mcp.call`, the extension routed the successful result to attachment transport, synthesized `tool-result--local.mcp.call--call_f05c7fd81b136353_2bcdaab7.json`, uploaded it through ChatGPT without a file-picker interaction, waited for the attachment readiness gate, and inserted the correlated `<tool_result_ref>`. The resulting conversation attachment is readable by the model and contains protocol `chat-shim-tool-result/v1`, the matching call ID, `broker.large_result`, and `requested_bytes: 65536`. Final automatic submission of the attachment/reference remains explicitly unverified until the user confirms they did not press Send for this run.

## Checklist

- [x] Define result-size decision function.
- [x] Implement result envelope version `chat-shim-tool-result/v1`.
- [x] Include call ID in every result artifact.
- [x] Generate human-readable attachment filenames.
- [x] Create `File` objects in the content-script/page integration path.
- [x] Add a bounded deterministic large-result broker test fixture.
- [x] Verify a stable ChatGPT file-input/upload path in current Edge.
- [x] Verify upload without user file-picker interaction.
- [x] Verify attachment upload presence/start detection in the live page.
- [x] Verify attachment-ready completion state.
- [x] Gate auto-submit behind attachment-ready in the implementation.
- [x] Submit `<tool_result_ref>` only after the readiness gate resolves.
- [x] Handle upload failure with a compact error result.
- [x] Reuse call fingerprint dedupe to prevent duplicate delivery on repeated DOM mutations.
- [x] Run JSON attachment test in the real page.
- [ ] Verify automatic submission of attachment + `<tool_result_ref>` with no manual Send action.
- [ ] Test plain-text/source-file attachment.
- [ ] Test >1 MB result.
- [ ] Test binary attachment.
- [x] Add attachment-state events to extension diagnostics.

## Exit condition

A large tool result travels from tool runtime to ChatGPT as an attachment and the model-visible reference is submitted automatically only after upload completion.
