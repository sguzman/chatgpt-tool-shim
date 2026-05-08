import type { ToolName, ToolRequest } from "./types";

const KNOWN_TOOLS: ToolName[] = [
  "hello",
  "clock",
  "clock.now",
  "browser.tabs.list",
  "browser.tab.metadata",
  "browser.tab.links",
  "browser.tab.read_text",
  "local.mcp.call"
];

export function isKnownToolName(name: string): name is ToolName {
  return KNOWN_TOOLS.includes(name as ToolName);
}

function requireObject(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return args as Record<string, unknown>;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

export function validateToolRequest(request: ToolRequest): ToolRequest {
  if (!request.id.trim()) {
    throw new Error("Tool request id is required.");
  }
  if (!isKnownToolName(request.name)) {
    throw new Error(`Unknown tool: ${request.name}`);
  }

  const args = requireObject(request.args);
  switch (request.name) {
    case "hello":
    case "clock":
    case "clock.now":
      request.args = {};
      break;
    case "browser.tabs.list":
      request.args = {
        currentWindowOnly:
          args.currentWindowOnly === undefined
            ? true
            : requireBoolean(args.currentWindowOnly, "currentWindowOnly")
      };
      break;
    case "browser.tab.metadata":
      request.args = { tabId: requireNumber(args.tabId, "tabId") };
      break;
    case "browser.tab.links":
      request.args = {
        tabId: requireNumber(args.tabId, "tabId"),
        limit: args.limit === undefined ? 200 : requireNumber(args.limit, "limit")
      };
      break;
    case "browser.tab.read_text":
      request.args = {
        tabId: requireNumber(args.tabId, "tabId"),
        maxChars: args.maxChars === undefined ? 20000 : requireNumber(args.maxChars, "maxChars")
      };
      break;
    case "local.mcp.call":
      request.args = {
        tool: requireString(args.tool, "tool"),
        args: args.args ?? {}
      };
      break;
    default:
      throw new Error(`Unhandled tool: ${(request as ToolRequest).name}`);
  }

  return request;
}
