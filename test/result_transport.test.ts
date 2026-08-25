import { describe, expect, test } from "vitest";

import type { ExtensionSettings, ToolResult } from "../src/protocol/types";
import {
  buildAttachmentResultFilename,
  buildToolResultRef,
  prepareToolResultTransport
} from "../src/ui/result_transport";

const settings: ExtensionSettings = {
  enabled: true,
  autoRunSafeTools: true,
  autoSubmitToolResults: false,
  localhostBridgeEnabled: false,
  localhostBridgeUrl: "http://127.0.0.1:3210/tool",
  localhostBridgeToken: "",
  sensitiveDomainBlocklist: [],
  maxAuditEntries: 200,
  attachmentResultsEnabled: true,
  attachmentThresholdBytes: 1024,
  attachmentUploadTimeoutMs: 30_000
};

function result(payload: unknown): ToolResult {
  return {
    id: "call_a831d2",
    name: "filesystem.read_text",
    ok: true,
    result: payload
  };
}

describe("attachment result transport", () => {
  test("keeps small results inline", () => {
    const prepared = prepareToolResultTransport(result({ value: "ok" }), settings);
    expect(prepared.mode).toBe("inline");
  });

  test("moves large results to an attachment", () => {
    const prepared = prepareToolResultTransport(result({ value: "x".repeat(5_000) }), settings);
    expect(prepared.mode).toBe("attachment");
    if (prepared.mode === "attachment") {
      expect(prepared.filename).toContain("filesystem.read_text");
      expect(prepared.filename).toContain("call_a831d2");
      expect(prepared.file.type).toBe("application/json");
      expect(prepared.messageText).toContain("<tool_result_ref");
    }
  });

  test("keeps error results inline even when large", () => {
    const prepared = prepareToolResultTransport(
      {
        id: "call_error",
        name: "filesystem.read_text",
        ok: false,
        error: { code: "FAIL", message: "x".repeat(5_000) }
      },
      settings
    );
    expect(prepared.mode).toBe("inline");
  });

  test("sanitizes filenames and escapes refs", () => {
    const weird: ToolResult = {
      id: 'call<"1',
      name: "local tool/read",
      ok: true,
      result: {}
    };
    const filename = buildAttachmentResultFilename(weird);
    expect(filename).not.toContain("/");
    const ref = buildToolResultRef(weird, filename);
    expect(ref).toContain("&lt;");
    expect(ref).toContain("&quot;");
  });
});
