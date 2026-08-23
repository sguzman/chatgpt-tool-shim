# M2 — Attachment Result Transport

## Goal

Replace huge/manual result messages with reliable attachment delivery for large or file-native tool output.

## Implementation note — 2026-08-22

The restart branch now has an initial implementation for size-based routing, versioned JSON result envelopes, correlated filenames and `<tool_result_ref>` messages, synthetic `File` upload through ChatGPT's file input, a conservative attachment-ready wait, delivery-state tracing, and compact delivery errors. Runtime-sensitive boxes remain unchecked until the current ChatGPT UI verifies them.

## Checklist

- [x] Define result-size decision function.
- [x] Implement result envelope version `chat-shim-tool-result/v1`.
- [x] Include call ID in every result artifact.
- [x] Generate human-readable attachment filenames.
- [x] Create `File` objects in the content-script/page integration path.
- [ ] Verify a stable ChatGPT file-input/upload path in current Edge.
- [ ] Verify upload without user file-picker interaction.
- [ ] Verify attachment upload start detection.
- [ ] Verify attachment-ready completion state.
- [x] Gate auto-submit behind attachment-ready in the implementation.
- [x] Submit `<tool_result_ref>` only after the readiness gate resolves.
- [x] Handle upload failure with a compact error result.
- [x] Reuse call fingerprint dedupe to prevent duplicate delivery on repeated DOM mutations.
- [ ] Run JSON attachment test in the real page.
- [ ] Test plain-text/source-file attachment.
- [ ] Test >1 MB result.
- [ ] Test binary attachment.
- [x] Add attachment-state events to extension diagnostics.

## Exit condition

A large tool result travels from tool runtime to ChatGPT as an attachment and the model-visible reference is submitted automatically only after upload completion.
