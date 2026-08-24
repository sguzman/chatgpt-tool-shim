# M2 — Attachment Result Transport

## Goal

Replace huge/manual result messages with reliable attachment delivery for large or file-native tool output.

## Implementation note — 2026-08-23

The restart branch has an initial implementation for size-based routing, versioned JSON result envelopes, correlated filenames and `<tool_result_ref>` messages, synthetic `File` upload through ChatGPT's file input, a conservative attachment-ready wait, delivery-state tracing, and compact delivery errors.

A bounded `broker.large_result` capability provides a deterministic attachment-test payload without exposing filesystem resources. It defaults to 64 KiB, accepts an explicit integer byte count, and rejects requests above 2 MiB. Unit coverage verifies the default, explicit sizes, and rejection bounds.

The first live Edge attachment run succeeded for a 65,536-byte broker payload. The call intentionally paused at the `local.mcp.call` permission boundary; the user initially mistook that pause for a stall because the confirmation prompt was easy to miss. After the user approved the call, the extension routed the successful result to attachment transport, synthesized `tool-result--local.mcp.call--call_f05c7fd81b136353_2bcdaab7.json`, uploaded it through ChatGPT without a file-picker interaction, waited for the attachment readiness gate, inserted the correlated `<tool_result_ref>`, and automatically submitted the attachment/reference without any manual Send action. The resulting conversation attachment is readable by the model and contains protocol `chat-shim-tool-result/v1`, the matching call ID, `broker.large_result`, and `requested_bytes: 65536`.

The permission pause itself is correct behavior; the usability follow-up is to make a pending confirmation visually harder to miss in the movable HUD.

A later 1,310,720-byte (1.25 MiB) broker test verified that the large-result generator, JSON envelope, synthetic File creation, upload path, attachment-ready gate, and model-readable attachment all work above 1 MiB. The received artifact reports protocol `chat-shim-tool-result/v1`, the matching call ID, `broker.large_result`, and `requested_bytes: 1310720`.

That same run exposed a separate background-submission failure after the attachment had been prepared. While persistent Background Mode was enabled and Edge was unfocused, the shim found the correct enabled `send-button`, then attempted form `requestSubmit`, synthetic mouse activation, and Enter-key activation. None produced the existing composer-cleared/user-message-added success signal within the configured 1,750 ms observation window, so the shim emitted a compact `RESULT_DELIVERY_ERROR`. The >1 MiB attachment transport is therefore verified, but unfocused attachment Auto Submit is not yet verified. Diagnostics from the failing run should determine whether the attachment readiness gate fired too early or whether attachment-bearing submits simply need a longer/different acknowledgement signal before fallback activation.

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
- [x] Verify automatic submission of attachment + `<tool_result_ref>` with no manual Send action for the 65,536-byte foreground path.
- [ ] Test plain-text/source-file attachment.
- [x] Test >1 MB result.
- [ ] Verify attachment + `<tool_result_ref>` Auto Submit while Edge is unfocused.
- [ ] Test binary attachment.
- [x] Add attachment-state events to extension diagnostics.

## Exit condition

A large tool result travels from tool runtime to ChatGPT as an attachment and the model-visible reference is submitted automatically only after upload completion.

**Exit condition verified in the live Edge session for the 65,536-byte JSON result path. The >1 MiB transport itself is also verified; unfocused attachment Auto Submit remains unresolved.**
