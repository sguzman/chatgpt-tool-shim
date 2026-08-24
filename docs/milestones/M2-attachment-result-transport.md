# M2 — Attachment Result Transport

## Goal

Replace huge/manual result messages with reliable attachment delivery for large or file-native tool output.

## Implementation note — 2026-08-23

The restart branch has an initial implementation for size-based routing, versioned JSON result envelopes, correlated filenames and `<tool_result_ref>` messages, synthetic `File` upload through ChatGPT's file input, a conservative attachment-ready wait, delivery-state tracing, and compact delivery errors.

A bounded `broker.large_result` capability provides a deterministic attachment-test payload without exposing filesystem resources. It defaults to 64 KiB, accepts an explicit integer byte count, and rejects requests above 2 MiB. Unit coverage verifies the default, explicit sizes, and rejection bounds.

The first live Edge attachment run succeeded for a 65,536-byte broker payload. The call intentionally paused at the `local.mcp.call` permission boundary; the user initially mistook that pause for a stall because the confirmation prompt was easy to miss. After the user approved the call, the extension routed the successful result to attachment transport, synthesized `tool-result--local.mcp.call--call_f05c7fd81b136353_2bcdaab7.json`, uploaded it through ChatGPT without a file-picker interaction, waited for the attachment readiness gate, inserted the correlated `<tool_result_ref>`, and automatically submitted the attachment/reference without any manual Send action. The resulting conversation attachment is readable by the model and contains protocol `chat-shim-tool-result/v1`, the matching call ID, `broker.large_result`, and `requested_bytes: 65536`.

The permission pause itself is correct behavior; the usability follow-up is to make a pending confirmation visually harder to miss in the movable HUD.

A later 1,310,720-byte (1.25 MiB) broker test verified that the large-result generator, JSON envelope, synthetic File creation, upload path, and model-readable attachment all work above 1 MiB. The received artifact reports protocol `chat-shim-tool-result/v1`, the matching call ID, `broker.large_result`, and `requested_bytes: 1310720`.

That same run exposed a separate attachment-submission failure. The permission boundary means the run was not a fully unattended background-attachment acceptance test: detection and `WAITING_CONFIRMATION` occurred while unfocused, but the user necessarily refocused Edge to click **Run**. Diagnostics then showed `CONFIRMED`, dispatch, result packaging, `ATTACHING`, the readiness gate, and the start of `SUBMITTING` while focused. The user moved away again and the eventual `DELIVERY_ERROR` occurred unfocused. The text and attachment remained in the composer until the user manually submitted them.

The diagnostics also identified a concrete readiness bug rather than merely a background-mode problem: the 1.31 MB attachment was declared `ATTACHMENT_READY` only **70 ms** after attachment started. The readiness implementation counted three successful polls, but its wait helper intentionally wakes early on arbitrary DOM mutation to support background tabs. Three DOM wakeups could therefore occur in a few milliseconds and were not evidence that an upload had actually settled.

The readiness implementation was then hardened. It measures continuous **wall-clock stability** instead of poll count, resets the stable interval whenever the filename disappears or an upload/processing indicator is visible, and inspects the filename chip's nearby DOM for busy state. The minimum stable window is 1.5 seconds for files up to 256 KiB, 3 seconds through 1 MiB, and 5 seconds above 1 MiB. Attachment-bearing Auto Submit also receives a minimum five-second submission-observation window per activation method instead of inheriting the 1.75-second plain-text acknowledgement window.

The immediate live retry of the same 1,310,720-byte broker result succeeded. After the user approved the permission-gated call, they observed the attachment finish uploading, remain in the composer briefly while the hardened settle gate completed, and then the shim automatically submitted the attachment plus `<tool_result_ref>` roughly one to two seconds later without any manual Send action. The resulting conversation artifact is model-readable and reports the expected call ID and `requested_bytes: 1310720`. This verifies that the wall-clock readiness fix repaired the foreground >1 MiB Auto Submit regression. Unfocused attachment submission remains a separate acceptance test because the MCP permission boundary still requires the user to focus the window to approve execution.

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
- [x] Implement attachment-ready completion state.
- [x] Harden readiness against mutation-driven false-positive stability.
- [x] Gate auto-submit behind attachment-ready in the implementation.
- [x] Submit `<tool_result_ref>` only after the readiness gate resolves.
- [x] Handle upload failure with a compact error result.
- [x] Reuse call fingerprint dedupe to prevent duplicate delivery on repeated DOM mutations.
- [x] Run JSON attachment test in the real page.
- [x] Verify automatic submission of attachment + `<tool_result_ref>` with no manual Send action for the 65,536-byte foreground path.
- [x] Reverify attachment Auto Submit after wall-clock readiness hardening with a 1.25 MiB foreground result.
- [ ] Test plain-text/source-file attachment.
- [x] Test >1 MB result.
- [ ] Verify attachment + `<tool_result_ref>` Auto Submit while Edge is unfocused after approval.
- [ ] Test binary attachment.
- [x] Add attachment-state events to extension diagnostics.

## Exit condition

A large tool result travels from tool runtime to ChatGPT as an attachment and the model-visible reference is submitted automatically only after upload completion.

**Exit condition verified in the live Edge session for both the 65,536-byte JSON result path and the repaired 1.25 MiB foreground path. Unfocused attachment Auto Submit remains a separate acceptance test.**
