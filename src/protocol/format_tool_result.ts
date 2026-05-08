import type { ToolResult } from "./types";

export function formatToolResult(result: ToolResult): string {
  const payload = result.ok
    ? { ok: true, ...(result.result as Record<string, unknown> | undefined) }
    : { ok: false, error: result.error };

  return `<tool_result name="${result.name}" id="${result.id}">\n${JSON.stringify(payload, null, 2)}\n</tool_result>`;
}
