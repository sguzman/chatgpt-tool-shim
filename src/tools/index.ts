import type { ExtensionSettings, ToolPolicy, ToolRequest } from "../protocol/types";
import { browserTabLinks } from "./browser_tab_links";
import { browserTabMetadata } from "./browser_tab_metadata";
import { browserTabReadText } from "./browser_tab_read_text";
import { browserTabsList } from "./browser_tabs_list";
import { clock } from "./clock";
import { clockNow } from "./clock_now";
import { hello } from "./hello";
import { localMcpCall } from "./local_mcp_call";

type ToolHandler = (args: any, settings: ExtensionSettings) => Promise<unknown>;

export const TOOL_POLICIES: Record<string, ToolPolicy> = {
  hello: { mode: "auto", risk: "none" },
  clock: { mode: "auto", risk: "none" },
  "clock.now": { mode: "auto", risk: "none" },
  "browser.tabs.list": { mode: "auto", risk: "read" },
  "browser.tab.metadata": { mode: "auto", risk: "read" },
  "browser.tab.links": { mode: "auto", risk: "read" },
  "browser.tab.read_text": { mode: "confirm", risk: "read_page_content" },
  "local.mcp.call": { mode: "confirm", risk: "read_page_content" }
};

const toolHandlers: Record<string, ToolHandler> = {
  hello: async () => hello(),
  clock: async () => clock(),
  "clock.now": async () => clockNow(),
  "browser.tabs.list": async (args) => browserTabsList(args),
  "browser.tab.metadata": async (args) => browserTabMetadata(args),
  "browser.tab.links": async (args) => browserTabLinks(args),
  "browser.tab.read_text": async (args) => browserTabReadText(args),
  "local.mcp.call": async (args, settings) => localMcpCall(args, settings)
};

export function getToolPolicy(name: string): ToolPolicy | null {
  return TOOL_POLICIES[name] ?? null;
}

export async function executeToolRequest(
  request: ToolRequest,
  settings: ExtensionSettings
): Promise<unknown> {
  const handler = toolHandlers[request.name];
  if (!handler) {
    throw new Error(`No handler registered for tool ${request.name}.`);
  }
  return handler(request.args, settings);
}
