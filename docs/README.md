# Documentation Index

This directory is the canonical project memory for the August 2026 restart.

## Architecture

- [System overview](architecture/system-overview.md) — component boundaries and data flow.
- [Local capability broker](architecture/local-capability-broker.md) — server responsibilities, APIs, registry, ontology, policy, and execution model.

## Decisions

- [ADR 0001: Keep the server in this repository during the restart](decisions/0001-server-in-monorepo-for-restart.md)

## Protocol

- [Tool result transport](protocol/result-transport.md) — inline results, attachment results, correlation, state machine, and upload completion rules.

## Milestones

- [Restart milestone index](milestones/README.md)
- [M0 — Restart baseline](milestones/M0-restart-baseline.md)
- [M1 — Revalidate the ChatGPT loop](milestones/M1-chatgpt-loop-revalidation.md)
- [M2 — Attachment result transport](milestones/M2-attachment-result-transport.md)
- [M3 — Local broker MVP](milestones/M3-local-broker-mvp.md)
- [M4 — MCP registry and ontology](milestones/M4-mcp-registry-and-ontology.md)
- [M5 — Capability and resource boundaries](milestones/M5-capability-and-resource-boundaries.md)
- [M6 — Hardening and multi-adapter future](milestones/M6-hardening-and-multi-adapter-future.md)

## Debugging

- [Debug bundle specification](debug/debug-bundle.md)

## Historical plan

- [Original project plan](plans/chatgpt-tool-shim-project-plan.md) — useful implementation history, but no longer the canonical roadmap.
