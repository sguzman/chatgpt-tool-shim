# Restart Milestones

This directory is the canonical execution plan for the August 2026 restart. Check boxes should reflect verified repository/runtime state, not intentions.

## Sequence

1. [M0 — Restart baseline](M0-restart-baseline.md)
2. [M1 — Revalidate the ChatGPT loop](M1-chatgpt-loop-revalidation.md)
3. [M2 — Attachment result transport](M2-attachment-result-transport.md)
4. [M3 — Local broker MVP](M3-local-broker-mvp.md)
5. [M4 — MCP registry and ontology](M4-mcp-registry-and-ontology.md)
6. [M5 — Capability and resource boundaries](M5-capability-and-resource-boundaries.md)
7. [M6 — Hardening and multi-adapter future](M6-hardening-and-multi-adapter-future.md)

## Status convention

- `[x]` verified complete.
- `[ ]` not complete or not reverified.
- Add a short note beneath a checkbox when "implemented previously" differs from "verified now".

## Restart priorities

The first useful end-to-end target is intentionally narrow:

```text
ChatGPT call
  -> extension detects it
  -> broker executes one local capability
  -> extension returns result automatically
  -> debug bundle can explain the transaction
```

MCP breadth and rich ontology come after that loop is reliable.
