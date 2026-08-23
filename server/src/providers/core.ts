import os from "node:os";
import type { CapabilityRegistry } from "../registry";

const DEFAULT_LARGE_RESULT_BYTES = 64 * 1024;
const MAX_LARGE_RESULT_BYTES = 2 * 1024 * 1024;

function parseLargeResultBytes(args: unknown): number {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("broker.large_result arguments must be an object.");
  }

  const bytes = (args as Record<string, unknown>).bytes ?? DEFAULT_LARGE_RESULT_BYTES;
  if (!Number.isInteger(bytes) || typeof bytes !== "number") {
    throw new Error("broker.large_result bytes must be an integer.");
  }
  if (bytes < 1 || bytes > MAX_LARGE_RESULT_BYTES) {
    throw new Error(
      `broker.large_result bytes must be between 1 and ${MAX_LARGE_RESULT_BYTES}.`
    );
  }
  return bytes;
}

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
    name: "broker.large_result",
    description:
      "Return a deterministic bounded text payload for testing large-result and attachment transport.",
    risk: "none",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        bytes: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LARGE_RESULT_BYTES,
          default: DEFAULT_LARGE_RESULT_BYTES
        }
      }
    },
    execute: (args, context) => {
      const bytes = parseLargeResultBytes(args);
      return {
        purpose: "chatgpt-tool-shim attachment transport test",
        request_id: context.requestId,
        requested_bytes: bytes,
        payload: "x".repeat(bytes)
      };
    }
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
