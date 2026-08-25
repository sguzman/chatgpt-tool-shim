# M0 — Restart Baseline

## Goal

Turn the dormant proof-of-concept into a project with explicit current state, architecture, decisions, milestones, and debugging conventions.

## Checklist

- [x] Existing MV3 extension scaffold exists.
- [x] Existing tool parser/result formatter exists.
- [x] Existing ChatGPT DOM observer and composer integration exists.
- [x] Existing service-worker tool broker exists.
- [x] Existing browser tools exist.
- [x] Existing confirmation, settings, and audit-log paths exist.
- [x] Extension-side `local.mcp.call` HTTP prototype exists.
- [x] Restart architecture separates ChatGPT adapter from local capability broker.
- [x] Server repository-boundary decision documented.
- [x] Checkbox milestone system created.
- [x] Attachment result transport concept formalized.
- [x] Debug bundle contract documented.
- [x] Initial Windows ZIP debug collector added.
- [ ] Current dependency install succeeds on a clean checkout.
- [ ] `npm test` reverified after restart.
- [ ] `npm run build` reverified after restart.

## Exit condition

The repository contains enough durable project memory that development can resume without reconstructing the architecture from chat history.
