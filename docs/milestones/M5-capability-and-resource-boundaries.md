# M5 — Capability and Resource Boundaries

## Goal

Make local authority explicit, narrow, inspectable, and independent from raw tool registration.

## Checklist

- [ ] Define stable resource IDs.
- [ ] Implement project/directory resource registration.
- [ ] Separate raw path locators from resource identity.
- [ ] Define read/write/execute operation classes.
- [ ] Define capability-lease/session-scope model.
- [ ] Implement explicit allow rules.
- [ ] Implement explicit deny rules.
- [ ] Deny wins over allow.
- [ ] Add default-sensitive resource classes.
- [ ] Prevent provider registration from granting authority implicitly.
- [ ] Evaluate tool risk and resource scope together.
- [ ] Add confirmation-required policy outcome.
- [ ] Add permanent/local policy rules.
- [ ] Make policy decisions auditable.
- [ ] Add resource/policy decision traces to call-centric debug bundle.
- [ ] Test path traversal attempts.
- [ ] Test symlink/junction boundary escapes.
- [ ] Test unauthorized sibling directories.
- [ ] Test allowed project subtree.
- [ ] Test revoked lease.

## Exit condition

A broadly capable provider can be registered while a ChatGPT session remains restricted to explicitly granted resources and operations.
