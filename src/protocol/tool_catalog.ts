export type ToolCatalogEntry = {
  name: string;
  description: string;
  args: string;
  mode: "auto" | "confirm";
};

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    name: "hello",
    description: "Return a trivial hello payload for end-to-end smoke testing.",
    args: "{}",
    mode: "auto"
  },
  {
    name: "clock",
    description: "Return the current local time in the browser timezone.",
    args: "{}",
    mode: "auto"
  },
  {
    name: "clock.now",
    description: "Return an ISO timestamp and browser timezone.",
    args: "{}",
    mode: "auto"
  },
  {
    name: "browser.tabs.list",
    description: "List browser tabs with basic metadata.",
    args: '{ "currentWindowOnly": true }',
    mode: "auto"
  },
  {
    name: "browser.tab.metadata",
    description: "Return metadata for a specific tab id.",
    args: '{ "tabId": 123 }',
    mode: "auto"
  },
  {
    name: "browser.tab.links",
    description: "Return links from a specific tab.",
    args: '{ "tabId": 123, "limit": 200 }',
    mode: "auto"
  },
  {
    name: "browser.tab.read_text",
    description: "Return visible text and page structure from a tab.",
    args: '{ "tabId": 123, "maxChars": 20000 }',
    mode: "confirm"
  },
  {
    name: "local.mcp.call",
    description: "Call the optional localhost bridge.",
    args: '{ "tool": "name", "args": {} }',
    mode: "confirm"
  }
];

export function buildToolCatalogText(): string {
  const lines = TOOL_CATALOG.map(
    (entry) => `- ${entry.name} [${entry.mode}] ${entry.description} Args: ${entry.args}`
  );

  return ["Available tools:", ...lines].join("\n");
}

export function buildPrimingPrompt(): string {
  return [
    "You have access to client-side tools through my browser extension.",
    "",
    "When you need a tool, output exactly one tool call and nothing else:",
    "",
    '<tool_call name="TOOL_NAME">',
    "JSON_ARGUMENTS",
    "</tool_call>",
    "",
    "After I provide a <tool_result>, continue normally.",
    "Do not invent tool results.",
    "Do not describe the tool call before or after emitting it.",
    "",
    buildToolCatalogText()
  ].join("\n");
}
