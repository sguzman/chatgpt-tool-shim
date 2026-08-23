import { formatToolResult } from "../protocol/format_tool_result";
import type { ExtensionSettings, ToolResult } from "../protocol/types";

export type PreparedToolResult =
  | {
      mode: "inline";
      messageText: string;
      byteLength: number;
    }
  | {
      mode: "attachment";
      messageText: string;
      byteLength: number;
      file: File;
      filename: string;
    };

function safeToolSegment(toolName: string): string {
  const normalized = toolName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "tool";
}

function safeCallSegment(callId: string): string {
  const normalized = callId.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "call";
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildAttachmentResultFilename(result: ToolResult): string {
  return `tool-result--${safeToolSegment(result.name)}--${safeCallSegment(result.id)}.json`;
}

export function buildAttachmentEnvelope(result: ToolResult) {
  return {
    protocol: "chat-shim-tool-result/v1",
    call_id: result.id,
    tool: result.name,
    ok: result.ok,
    result: result.result,
    error: result.error
  };
}

export function buildToolResultRef(result: ToolResult, filename: string): string {
  return [
    "<tool_result_ref",
    ` id="${escapeXmlAttribute(result.id)}"`,
    ` name="${escapeXmlAttribute(result.name)}"`,
    ` attachment="${escapeXmlAttribute(filename)}"`,
    " />"
  ].join("");
}

export function prepareToolResultTransport(
  result: ToolResult,
  settings: ExtensionSettings
): PreparedToolResult {
  const formatted = formatToolResult(result);
  const inlineBytes = new TextEncoder().encode(formatted).byteLength;

  if (
    !result.ok ||
    !settings.attachmentResultsEnabled ||
    inlineBytes < settings.attachmentThresholdBytes
  ) {
    return {
      mode: "inline",
      messageText: formatted,
      byteLength: inlineBytes
    };
  }

  const filename = buildAttachmentResultFilename(result);
  const envelopeJson = JSON.stringify(buildAttachmentEnvelope(result), null, 2);
  const file = new File([envelopeJson], filename, { type: "application/json" });

  return {
    mode: "attachment",
    messageText: buildToolResultRef(result, filename),
    byteLength: new TextEncoder().encode(envelopeJson).byteLength,
    file,
    filename
  };
}
