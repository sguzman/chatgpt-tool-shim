import { formatToolResult } from "./protocol/format_tool_result";
import { parseLatestToolCall } from "./protocol/parse_tool_calls";
import { buildPrimingPrompt, buildToolCatalogText } from "./protocol/tool_catalog";
import type {
  AuditLogEntry,
  ExtensionSettings,
  PrepareToolResponse,
  RuntimeMessage,
  ToolRequest
} from "./protocol/types";
import { insertIntoComposer, submitComposer } from "./ui/composer";
import { createOverlay, type OverlayController } from "./ui/overlay";
import { findLatestAssistantMessage, getAssistantMessageText } from "./ui/selectors";

async function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

type PendingConfirmation = {
  request: ToolRequest;
  message: string;
};

let settings: ExtensionSettings;
let overlay: OverlayController;
let pendingConfirmation: PendingConfirmation | null = null;
const seenFingerprints = new Set<string>();
let scanTimer: number | null = null;

async function refreshSettings() {
  settings = await sendMessage<ExtensionSettings>({ type: "GET_SETTINGS" });
  overlay.setSettings(settings);
}

async function applySettings(patch: Partial<ExtensionSettings>) {
  settings = await sendMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", patch });
  overlay.setSettings(settings);
}

async function insertResultText(text: string) {
  insertIntoComposer(text);
  if (settings.autoSubmitToolResults) {
    submitComposer();
  }
}

async function insertErrorResult(request: ToolRequest, code: string, message: string) {
  const text = formatToolResult({
    id: request.id,
    name: request.name,
    ok: false,
    error: { code, message }
  });
  await insertResultText(text);
}

async function appendAuditEntry(
  request: ToolRequest,
  outcome: "success" | "error" | "denied",
  detail: string
) {
  await sendMessage({
    type: "APPEND_AUDIT_LOG",
    entry: {
      id: request.id,
      timestamp: new Date().toISOString(),
      toolName: request.name,
      argsSummary: JSON.stringify(request.args),
      target: request.source.chatUrl,
      outcome,
      detail
    }
  });
}

async function executeRequest(request: ToolRequest) {
  overlay.clearConfirmation();
  overlay.setStatus({ state: "running", lastTool: request.name, lastError: "none" });
  const response = await sendMessage<{ formatted: string; ok: boolean; error?: { message: string } }>({
    type: "EXECUTE_TOOL_CALL",
    request
  });

  await insertResultText(response.formatted);
  overlay.setStatus({
    state: "watching",
    lastTool: request.name,
    lastError: response.ok ? "none" : response.error?.message ?? "Execution failed."
  });
}

async function processLatestAssistantMessage() {
  if (!settings.enabled) {
    overlay.setStatus({ state: "idle" });
    return;
  }

  const latestMessage = findLatestAssistantMessage();
  if (!latestMessage) {
    return;
  }

  const text = getAssistantMessageText(latestMessage);
  const parsed = parseLatestToolCall(text);
  if (!parsed || seenFingerprints.has(parsed.fingerprint)) {
    return;
  }

  seenFingerprints.add(parsed.fingerprint);
  overlay.setStatus({ state: "watching", lastTool: parsed.name, lastError: "none" });

  const source = {
    chatTabId: -1,
    chatUrl: location.href,
    assistantMessageKey: `${location.pathname}:${parsed.fingerprint}`
  };

  const preparation = await sendMessage<PrepareToolResponse>({
    type: "PREPARE_TOOL_CALL",
    call: parsed,
    source
  });

  if (!preparation.ok) {
    overlay.setStatus({ state: "error", lastError: preparation.message, lastTool: parsed.name });
    const failedRequest: ToolRequest = {
      id: parsed.id,
      name: parsed.name as ToolRequest["name"],
      args: parsed.args,
      source
    };
    await appendAuditEntry(failedRequest, "denied", `${preparation.code}: ${preparation.message}`);
    await insertErrorResult(failedRequest, preparation.code, preparation.message);
    return;
  }

  if (preparation.decision === "confirm") {
    pendingConfirmation = {
      request: preparation.request,
      message: preparation.confirmationText
    };
    overlay.showConfirmation(preparation.request, preparation.confirmationText);
    return;
  }

  if (preparation.decision === "auto" && settings.autoRunSafeTools) {
    await executeRequest(preparation.request);
    return;
  }

  pendingConfirmation = {
    request: preparation.request,
    message: "Auto-run is disabled. Approve execution manually."
  };
  overlay.showConfirmation(preparation.request, pendingConfirmation.message);
}

function scheduleScan() {
  if (scanTimer !== null) {
    window.clearTimeout(scanTimer);
  }
  scanTimer = window.setTimeout(() => {
    void processLatestAssistantMessage();
  }, 700);
}

function mountObserver() {
  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  scheduleScan();
}

async function openLog() {
  const entries = await sendMessage<AuditLogEntry[]>({ type: "GET_AUDIT_LOG" });
  overlay.showLog(entries);
}

async function init() {
  await sendMessage({ type: "PING" });
  overlay = createOverlay({
    onToggleEnabled: (enabled) => {
      void applySettings({ enabled });
    },
    onToggleAutoRun: (autoRunSafeTools) => {
      void applySettings({ autoRunSafeTools });
    },
    onToggleAutoSubmit: (autoSubmitToolResults) => {
      void applySettings({ autoSubmitToolResults });
    },
    onRequestLog: () => {
      void openLog();
    },
    onInsertPrompt: () => {
      void insertResultText(buildPrimingPrompt());
    },
    onInsertToolCatalog: () => {
      void insertResultText(buildToolCatalogText());
    },
    onConfirmRequest: () => {
      const current = pendingConfirmation;
      pendingConfirmation = null;
      if (current) {
        void executeRequest(current.request);
      }
    },
    onCancelRequest: () => {
      const current = pendingConfirmation;
      pendingConfirmation = null;
      overlay.clearConfirmation();
      overlay.setStatus({ state: "watching", lastError: "User denied execution." });
      if (current) {
        void appendAuditEntry(current.request, "denied", "User denied tool execution.");
        void insertErrorResult(current.request, "USER_DENIED", "User denied tool execution.");
      }
    }
  });

  await refreshSettings();
  overlay.setStatus({ state: "watching" });
  mountObserver();
}

void init();
