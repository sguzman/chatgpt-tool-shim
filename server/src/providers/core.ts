import os from "node:os";
import type { CapabilityRegistry } from "../registry";

export function registerCoreCapabilities(registry: CapabilityRegistry) {
  registry.register({
    name: "broker.hello",
    description: "Verify that the local capability broker is reachable and authenticated.",
    risk: "none",
    inputSchema: { type: "object", additionalProperties: false },
    execute: (_args, context) => ({
      hello: "from local capability broker",
      request_id: context.requestId
    })
  });

  registry.register({
    name: "broker.clock",
    description: "Return the broker machine's current time and timezone.",
    risk: "none",
    inputSchema: { type: "object", additionalProperties: false },
    execute: () => ({
      iso: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });

  registry.register({
    name: "system.runtime",
    description: "Return non-sensitive runtime metadata for broker diagnostics.",
    risk: "read",
    inputSchema: { type: "object", additionalProperties: false },
    execute: () => ({
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      hostname: os.hostname(),
      cwd: process.cwd()
    })
  });
}
