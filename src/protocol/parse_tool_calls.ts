import type { ParsedToolCall } from "./types";

const TOOL_CALL_REGEX = /<tool_call\b([^>]*)>([\s\S]*?)<\/tool_call>/g;

export function stripFencedCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `call_${(hash >>> 0).toString(16)}`;
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  for (let match = regex.exec(input); match; match = regex.exec(input)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

export function parseLatestToolCall(text: string): ParsedToolCall | null {
  const stripped = stripFencedCodeBlocks(text).trim();
  if (!stripped.includes("<tool_call")) {
    return null;
  }

  const matches = [...stripped.matchAll(TOOL_CALL_REGEX)];
  if (matches.length === 0) {
    return null;
  }

  const match = matches[matches.length - 1];
  const fullMatch = match[0].trim();
  if (stripped !== fullMatch) {
    return null;
  }

  const attributes = parseAttributes(match[1] ?? "");
  const name = attributes.name?.trim();
  if (!name) {
    return null;
  }

  const body = (match[2] ?? "").trim();
  let args: unknown;
  try {
    args = body.length > 0 ? JSON.parse(body) : {};
  } catch {
    return null;
  }

  const id = attributes.id?.trim() || hashString(`${name}:${body}`);
  return {
    id,
    name,
    args,
    raw: fullMatch,
    fingerprint: hashString(`${id}:${name}:${JSON.stringify(args)}`)
  };
}
