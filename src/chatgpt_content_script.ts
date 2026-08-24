import { formatToolResult } from "./protocol/format_tool_result";
import { parseLatestToolCall } from "./protocol/parse_tool_calls";
import { buildPrimingPrompt, buildToolCatalogText } from "./protocol/tool_catalog";
import type {
  AuditLogEntry,
  ExtensionSettings,
  PrepareToolResponse,
  RuntimeMessage,
  ToolRequest,
  ToolResult
} from "./protocol/types";
import { attachFileToComposer, insertIntoComposer, submitComposer } from "./ui/composer";
import {
  buildExtensionDiagnostics,
  downloadJsonFile,
  type ToolTraceEvent
} from "./ui/diagnostics";
import { createOverlay, type OverlayController } from "./ui/overlay";
import { prepareToolResultTransport } from "./ui/result_transport";
import { findLatestAssistantMessage, getAssistantMessageText } from "./ui/selectors";

async function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

type PendingConfirmation = {
  request: ToolRequest;
  message: string;
};

type ExecutionResponse = ToolResult & { formatted: string };

let settings: ExtensionSettings;
let overlay: OverlayController;
let pendingConfirmation: PendingConfirmation | null = null;
const seenFingerprints = new Set<string>();
const traceEvents: ToolTraceEvent[] = [];
let scanTimer: number | null = null;

function recordTrace(callId: string, toolName: string, state: string, detail?: string) {
  traceEvents.push({ timestamp: new Date().toISOString(), callId, toolName, state, detail });
  if (traceEvents.length > 300) {
    traceEvents.splice(0, traceEvents.length - 300);
  }
}

async function refreshSettings() {
  settings = await sendMessage<ExtensionSettings>({ type: "GET_SETTINGS" });
  overlay.setSettings(settings);
}

async function applySettings(patch: Partial<ExtensionSettings>) {
  settings = await sendMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", patch });
  overlay.setSettings(settings);
  if (patch.enabled !== undefined) {
    overlay.setStatus({ state: settings.enabled ? "watching" : "idle" });
  }
}

async function configureBroker() {
  const url = window.prompt("Local broker execute URL", settings.localhostBridgeUrl);
  if (url === null) return;
  const token = window.prompt(
    "Paste the broker token. Leave blank to keep the currently configured token.",
    ""
  );
  if (token === null) return;

  const trimmedUrl = url.trim();
  if (!trimmedUrl.startsWith("http://127.0.0.1:") && !trimmedUrl.startsWith("http://localhost:")) {
    throw new Error("Broker URL must use loopback HTTP (127.0.0.1 or localhost).");
  }

  await applySettings({
    localhostBridgeEnabled: true,
    localhostBridgeUrl: trimmedUrl,
    localhostBridgeToken: token.trim() || settings.localhostBridgeToken
  });
}

async function submitIfEnabled(request: Pick<ToolRequest, "id" | "name">) {
  if (!settings.autoSubmitToolResults) return;

  overlay.setStatus({ state: "submitting", lastTool: request.name });
  recordTrace(request.id, request.name, "SUBMITTING");

  const receipt = await submitComposer({ readyTimeoutMs: 5_000, clearTimeoutMs: 5_000 });
  recordTrace(
    request.id,
    request.name,
    "SUBMITTED",
    `${receipt.method}; ready after ${receipt.readyAfterMs}ms; composer cleared after ${receipt.clearedAfterMs}ms`
  );
}

async function insertInlineResult(request: ToolRequest, text: string) {
  insertIntoComposer(text);
  await submitIfEnabled(request);
}

function safeInsertPlainText(text: string, label: string) {
  try {
    insertIntoComposer(text);
    overlay.setStatus({ state: "watching", lastError: "none" });
  } catch (error) {
    overlay.setStatus({
      state: "error",
      lastError: `${label}: ${error instanceof Error ? error.message : "Insert failed."}`
    });
  }
}

async function insertErrorResult(
  request: ToolRequest,
  code: string,
  message: string,
  options: { autoSubmit?: boolean } = {}
) {
  const text = formatToolResult({
    id: request.id,
    name: request.name,
    ok: false,
    error: { code, message }
  });
  insertIntoComposer(text);
  if (options.autoSubmit ?? true) {
    await submitIfEnabled(request);
  }
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

async function deliverExecutionResult(request: ToolRequest, response: ExecutionResponse) {
  overlay.setStatus({ state: "packaging", lastTool: request.name, lastError: "none" });
  recordTrace(request.id, request.name, "PACKAGING");
  const prepared = prepareToolResultTransport(response, settings);

  if (prepared.mode === "inline") {
    recordTrace(request.id, request.name, "RESULT_INLINE", `${prepared.byteLength} bytes`);
    await insertInlineResult(request, prepared.messageText);
    return;
  }

  overlay.setStatus({ state: "attaching", lastTool: request.name });
  recordTrace(request.id, request.name, "ATTACHING", `${prepared.filename}; ${prepared.byteLength} bytes`);

  const receipt = await attachFileToComposer(prepared.file, {
    timeoutMs: settings.attachmentUploadTimeoutMs
  });
  recordTrace(
    request.id,
    request.name,
    "ATTACHMENT_READY",
    `${receipt.filename}; ready after ${receipt.readyAfterMs}ms`
  );

  insertIntoComposer(prepared.messageText);
  await submitIfEnabled(request);
}

async function executeRequest(request: ToolRequest) {
  overlay.clearConfirmation();
  overlay.setStatus({ state: "running", lastTool: request.name, lastError: "none" });
  recordTrace(request.id, request.name, "DISPATCHED");

  const response = await sendMessage<ExecutionResponse>({ type: "EXECUTE_TOOL_CALL", request });
  recordTrace(
    request.id,
    request.name,
    response.ok ? "RESULT_RECEIVED" : "TOOL_ERROR",
    response.ok ? undefined : response.error?.message
  );

  try {
    await deliverExecutionResult(request, response);
    overlay.setStatus({
      state: "watching",
      lastTool: request.name,
      lastError: response.ok ? "none" : response.error?.message ?? "Execution failed."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Result delivery failed.";
    recordTrace(request.id, request.name, "DELIVERY_ERROR", message);
    overlay.setStatus({ state: "error", lastTool: request.name, lastError: message });

    try {
      await insertErrorResult(request, "RESULT_DELIVERY_ERROR", message, { autoSubmit: false });
    } catch {
      // Diagnostics remain available even if the composer is currently broken.
    }
  }
}

async function processLatestAssistantMessage() {
  if (!settings.enabled) {
    overlay.setStatus({ state: "idle" });
    return;
  }

  const latestMessage = findLatestAssistantMessage();
  if (!latestMessage) return;

  const text = getAssistantMessageText(latestMessage);
  const parsed = parseLatestToolCall(text);
  if (!parsed || seenFingerprints.has(parsed.fingerprint)) return;

  seenFingerprints.add(parsed.fingerprint);
  recordTrace(parsed.id, parsed.name, "DETECTED", parsed.fingerprint);
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

  if (preparation.ok === false) {
    overlay.setStatus({ state: "error", lastError: preparation.message, lastTool: parsed.name });
    const failedRequest: ToolRequest = {
      id: parsed.id,
      name: parsed.name as ToolRequest["name"],
      args: parsed.args,
      source
    };
    recordTrace(parsed.id, parsed.name, "DENIED", `${preparation.code}: ${preparation.message}`);
    await appendAuditEntry(failedRequest, "denied", `${preparation.code}: ${preparation.message}`);
    await insertErrorResult(failedRequest, preparation.code, preparation.message);
    return;
  }

  recordTrace(preparation.request.id, preparation.request.name, "VALIDATED");

  if (preparation.decision === "confirm") {
    pendingConfirmation = { request: preparation.request, message: preparation.confirmationText };
    recordTrace(preparation.request.id, preparation.request.name, "WAITING_CONFIRMATION");
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
  recordTrace(preparation.request.id, preparation.request.name, "WAITING_CONFIRMATION");
  overlay.showConfirmation(preparation.request, pendingConfirmation.message);
}

function scheduleScan() {
  if (scanTimer !== null) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => void processLatestAssistantMessage(), 500);
}

function mountObserver() {
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scheduleScan();
}

async function openLog() {
  const entries = await sendMessage<AuditLogEntry[]>({ type: "GET_AUDIT_LOG" });
  overlay.showLog(entries);
}

async function downloadDiagnostics() {
  try {
    const entries = await sendMessage<AuditLogEntry[]>({ type: "GET_AUDIT_LOG" });
    const diagnostics = buildExtensionDiagnostics(settings, entries, traceEvents);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(`extension-diagnostics-${timestamp}.json`, diagnostics);
    overlay.setStatus({ state: "watching", lastError: "none" });
  } catch (error) {
    overlay.setStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : "Diagnostic export failed."
    });
  }
}

async function init() {
  await sendMessage({ type: "PING" });
  overlay = createOverlay({
    onToggleEnabled: (enabled) => void applySettings({ enabled }),
    onToggleAutoRun: (autoRunSafeTools) => void applySettings({ autoRunSafeTools }),
    onToggleAutoSubmit: (autoSubmitToolResults) => void applySettings({ autoSubmitToolResults }),
    onToggleAttachmentResults: (attachmentResultsEnabled) => void applySettings({ attachmentResultsEnabled }),
    onConfigureBroker: () => {
      void configureBroker().catch((error) => {
        overlay.setStatus({
          state: "error",
          lastError: error instanceof Error ? error.message : "Broker configuration failed."
        });
      });
    },
    onRequestLog: () => void openLog(),
    onDownloadDiagnostics: () => void downloadDiagnostics(),
    onInsertPrompt: () => safeInsertPlainText(buildPrimingPrompt(), "Insert prompt failed"),
    onInsertToolCatalog: () => safeInsertPlainText(buildToolCatalogText(), "Insert tools failed"),
    onInsertHelloCall: () => safeInsertPlainText('<tool_call name="hello">\n{}\n</tool_call>', "Insert hello failed"),
    onInsertClockCall: () => safeInsertPlainText('<tool_call name="clock">\n{}\n</tool_call>', "Insert clock failed"),
    onConfirmRequest: () => {
      const current = pendingConfirmation;
      pendingConfirmation = null;
      if (current) {
        recordTrace(current.request.id, current.request.name, "CONFIRMED");
        void executeRequest(current.request);
      }
    },
    onCancelRequest: () => {
      const current = pendingConfirmation;
      pendingConfirmation = null;
      overlay.clearConfirmation();
      overlay.setStatus({ state: "watching", lastError: "User denied execution." });
      if (current) {
        recordTrace(current.request.id, current.request.name, "DENIED", "User denied execution.");
        void appendAuditEntry(current.request, "denied", "User denied tool execution.");
        void insertErrorResult(current.request, "USER_DENIED", "User denied tool execution.");
      }
    }
  });

  await refreshSettings();
  overlay.setStatus({ state: "watching" });
  mountObserver();
}

void init().catch((error) => {
  console.error("ChatGPT Tool Shim initialization failed", error);
});
