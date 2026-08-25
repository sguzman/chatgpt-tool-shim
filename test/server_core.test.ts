import { describe, expect, test } from "vitest";

import { registerCoreCapabilities } from "../server/src/providers/core";
import { CapabilityRegistry } from "../server/src/registry";

function registry() {
  const value = new CapabilityRegistry();
  registerCoreCapabilities(value);
  return value;
}

const context = {
  requestId: "call_test",
  remoteAddress: "127.0.0.1"
};

describe("broker core capabilities", () => {
  test("large_result defaults to a 64 KiB deterministic payload", async () => {
    const result = (await registry().execute("broker.large_result", {}, context)) as {
      requested_bytes: number;
      request_id: string;
      payload: string;
    };

    expect(result.requested_bytes).toBe(64 * 1024);
    expect(result.request_id).toBe("call_test");
    expect(result.payload).toHaveLength(64 * 1024);
    expect(result.payload).toMatch(/^x+$/);
  });

  test("large_result honors a bounded explicit size", async () => {
    const result = (await registry().execute(
      "broker.large_result",
      { bytes: 32 * 1024 },
      context
    )) as { requested_bytes: number; payload: string };

    expect(result.requested_bytes).toBe(32 * 1024);
    expect(result.payload).toHaveLength(32 * 1024);
  });

  test("large_result rejects oversized payloads", async () => {
    await expect(
      registry().execute("broker.large_result", { bytes: 2 * 1024 * 1024 + 1 }, context)
    ).rejects.toThrow(/between 1 and 2097152/);
  });

  test("large_result rejects non-integer sizes", async () => {
    await expect(
      registry().execute("broker.large_result", { bytes: 12.5 }, context)
    ).rejects.toThrow(/must be an integer/);
  });
});
