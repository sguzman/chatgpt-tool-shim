# M6 — Hardening and Multi-Adapter Future

## Goal

Make the system resilient enough that the broker is not merely a ChatGPT-specific experiment.

## Checklist

- [ ] Add call-centric debug bundle export.
- [ ] Add structured tracing IDs across extension/broker/providers.
- [ ] Add retry semantics that distinguish safe retry from possible duplicate side effects.
- [ ] Add protocol compatibility/version negotiation.
- [ ] Add broker integration test harness independent of ChatGPT DOM.
- [ ] Add extension DOM fixture tests where practical.
- [ ] Add migration strategy for settings/config.
- [ ] Evaluate Chrome Native Messaging transport.
- [ ] Evaluate broker packaging/install strategy.
- [ ] Define frontend-adapter interface.
- [ ] Prototype a second frontend adapter only after broker boundary is stable.
- [ ] Re-evaluate repository split criteria from ADR 0001.
- [ ] Re-evaluate repository/project name if broker becomes dominant.
- [ ] Define release/versioning policy.
- [ ] Threat-model local web origins, CSRF-like loopback abuse, and malicious page content.
- [ ] Threat-model provider compromise and prompt-injected resource content.

## Exit condition

The local broker has a stable protocol, testable security boundary, useful diagnostics, and a credible path to clients beyond the current ChatGPT DOM adapter.
