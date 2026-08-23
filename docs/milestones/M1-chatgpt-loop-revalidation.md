# M1 — Revalidate the ChatGPT Loop

## Goal

Verify and repair the existing extension against the current ChatGPT web UI before building new server complexity.

## Implementation note — 2026-08-22

The restart branch now contains the first revalidation hardening pass: composer/send selectors are scoped and ranked more conservatively, the overlay can export DOM/selector diagnostics, and tool calls keep an in-memory correlated state trace. These changes are implemented but runtime-sensitive boxes remain unchecked until verified in a real current ChatGPT session.

The first Windows acceptance run verified a clean `npm ci`, all 18 current tests, and a successful patched `npm run build` for both extension and broker. The unpacked extension was then loaded in current Edge and the **Tool Shim · restart** overlay rendered successfully on `chatgpt.com`, reporting `watching` state. The remaining boxes require actual tool traffic rather than mere mounting.

## Checklist

- [x] Clean install dependencies.
- [x] Run protocol tests.
- [x] Build `dist/` successfully.
- [x] Load unpacked extension in current Edge.
- [x] Overlay appears on `chatgpt.com`.
- [ ] Latest assistant message selector still works.
- [ ] Streaming output does not trigger incomplete calls.
- [ ] Fenced example calls remain ignored.
- [ ] Fingerprint dedupe prevents duplicate execution.
- [ ] `hello` end-to-end call succeeds.
- [ ] `clock` end-to-end call succeeds.
- [ ] `clock.now` end-to-end call succeeds.
- [ ] `browser.tabs.list` succeeds.
- [ ] `browser.tab.metadata` succeeds.
- [ ] `browser.tab.links` succeeds.
- [ ] `browser.tab.read_text` confirmation succeeds.
- [ ] blocked-domain behavior still works.
- [ ] insert-only result mode works.
- [ ] auto-submit result mode works.
- [ ] send-button selector works across normal and streaming states.
- [ ] selector failures produce useful diagnostics.
- [ ] generate a debug bundle from a successful smoke test.
- [ ] generate a debug bundle from one intentionally failed call.

## Exit condition

A fresh browser session can execute the existing safe tool loop repeatedly without manual text copying and without duplicate calls.
