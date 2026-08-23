# ADR 0001 — Keep the Server in This Repository During the Restart

- **Status:** Accepted for restart
- **Date:** 2026-08-22

## Context

The existing repository already contains the ChatGPT extension, protocol parser, tool registry, settings, audit log, and an extension-side `local.mcp.call` HTTP transport. The next work adds a localhost broker that will evolve at the same time as the extension-to-broker protocol.

The broker may eventually become useful to clients other than this extension, so a separate repository is plausible. Splitting immediately, however, would force cross-repository protocol/version coordination before the boundary is stable.

## Decision

Keep the broker in this repository under `server/` for the restart.

Treat `server/` as a separately testable and releasable component with a versioned protocol boundary. Do not import browser DOM code into the broker, and do not make broker authorization depend on ChatGPT page state.

## Why this is the default now

- Extension and broker changes will frequently be coupled during protocol design.
- One branch/PR can update both sides atomically.
- Integration tests and debug bundles are easier in one checkout.
- Shared protocol fixtures can live in one place.
- There is no independent broker release cadence yet.
- The cost of a future split is low if the boundary remains clean.

## When to reconsider

Split the broker into its own repository when at least two of these become true:

- it supports multiple independent frontend adapters;
- it has an independent release/version cadence;
- it is packaged as a standalone installed service;
- it has substantial provider/plugin development independent of ChatGPT;
- its language/build system makes the monorepo materially awkward;
- external users would reasonably install the broker without the ChatGPT extension;
- protocol compatibility must be managed across independently deployed clients.

## Consequences

### Positive

- faster iteration across both halves;
- easier end-to-end testing;
- simpler debug artifact generation;
- protocol changes remain visible in one diff.

### Negative

- repository name remains ChatGPT-specific while the broker may generalize;
- build tooling may become heterogeneous;
- care is required to preserve a real component boundary.

## Future repository naming

Do not rename the repository during the restart. If the broker becomes the dominant project, consider either:

1. splitting it into a neutral repository; or
2. renaming the monorepo only after multiple adapters genuinely exist.

Architecture should lead naming, not anticipated future scope.
