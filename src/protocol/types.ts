export type ToolName =
  | "hello"
  | "clock"
  | "clock.now"
  | "browser.tabs.list"
  | "browser.tab.metadata"
  | "browser.tab.links"
  | "browser.tab.read_text"
  | "local.mcp.call";

export type ToolPolicyMode = "auto" | "confirm" | "deny";
export type ToolRisk = "none" | "read" | "read_page_content";

export type ToolPolicy = {
  mode: ToolPolicyMode;
  risk: ToolRisk;
};

export type ToolRequestSource = {
  chatTabId: number;
  chatUrl: string;
  assistantMessageKey: string;
};

export type ToolRequest = {
  id: string;
  name: ToolName;
  args: unknown;
  source: ToolRequestSource;
};

export type ToolResult = {
  id: string;
  name: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
};

export type ParsedToolCall = {
  id: string;
  name: string;
  args: unknown;
  raw: string;
  fingerprint: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  toolName: string;
  argsSummary: string;
  target: string;
  outcome: "success" | "error" | "denied";
  detail: string;
};

export type BackgroundProbeSample = {
  timestamp: string;
  tabId: number;
  ok: boolean;
  visibility?: DocumentVisibilityState;
  focused?: boolean;
  readyState?: DocumentReadyState;
  assistantMessages?: number;
  userMessages?: number;
  latestAssistantLength?: number;
  latestAssistantHasToolCall?: boolean;
  error?: string;
};

export type BackgroundModeState = {
  enabled: boolean;
  tabId?: number;
  url?: string;
  startedAt?: string;
};

export type ExtensionSettings = {
  enabled: boolean;
  autoRunSafeTools: boolean;
  autoSubmitToolResults: boolean;
  localhostBridgeEnabled: boolean;
  localhostBridgeUrl: string;
  localhostBridgeToken: string;
  sensitiveDomainBlocklist: string[];
  maxAuditEntries: number;
  attachmentResultsEnabled: boolean;
  attachmentThresholdBytes: number;
  attachmentUploadTimeoutMs: number;
};

export type PrepareToolResponse =
  | {
      ok: true;
      decision: "auto";
      request: ToolRequest;
      policy: ToolPolicy;
    }
  | {
      ok: true;
      decision: "confirm";
      request: ToolRequest;
      policy: ToolPolicy;
      confirmationText: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type RuntimeMessage =
  | { type: "PING" }
  | { type: "GET_SETTINGS" }
  | { type: "UPDATE_SETTINGS"; patch: Partial<ExtensionSettings> }
  | { type: "GET_AUDIT_LOG" }
  | { type: "APPEND_AUDIT_LOG"; entry: AuditLogEntry }
  | { type: "GET_BACKGROUND_PROBE_SAMPLES" }
  | { type: "RUN_BACKGROUND_PROBE"; durationMs?: number; intervalMs?: number }
  | { type: "GET_BACKGROUND_MODE_STATE" }
  | { type: "SET_BACKGROUND_MODE"; enabled: boolean }
  | { type: "ACTIVATE_CHATGPT_SUBMIT_MAIN_WORLD" }
  | { type: "PREPARE_TOOL_CALL"; call: ParsedToolCall; source: ToolRequestSource }
  | { type: "EXECUTE_TOOL_CALL"; request: ToolRequest };
