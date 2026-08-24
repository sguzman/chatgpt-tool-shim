import { formatToolResult } from "./protocol/format_tool_result";
import type {
  AuditLogEntry,
  BackgroundModeState,
  BackgroundProbeSample,
  PrepareToolResponse,
  RuntimeMessage,
  ToolRequest,
  ToolResult
} from "./protocol/types";
import { validateToolRequest } from "./protocol/validate";
import { appendAuditLog, getAuditLog } from "./storage/audit_log";
import { getSettings, updateSettings } from "./storage/settings";
import { executeToolRequest, getToolPolicy } from "./tools/index";

const BACKGROUND_PROBE_STORAGE_KEY = "chatgptToolShimBackgroundProbeSamples";
const BACKGROUND_MODE_STORAGE_KEY = "chatgptToolShimBackgroundModeState";
const MAX_BACKGROUND_PROBE_SAMPLES = 120;
const BACKGROUND_MODE_INTERVAL_MS = 1_000;

let backgroundLoopGeneration = 0;
let backgroundLoopTabId: number | null = null;

function makeAuditEntry(
  request: ToolRequest,
  outcome: AuditLogEntry["outcome"],
  detail: string
): AuditLogEntry {
  return {
    id: request.id,
    timestamp: new Date().toISOString(),
    toolName: request.name,
    argsSummary: JSON.stringify(request.args),
    target: request.source.chatUrl,
    outcome,
    detail
  };
}

function enrichRequestSource(
  request: ToolRequest,
  sender: chrome.runtime.MessageSender
): ToolRequest {
  return {
    ...request,
    source: {
      ...request.source,
      chatTabId: sender.tab?.id ?? request.source.chatTabId,
      chatUrl: sender.tab?.url ?? request.source.chatUrl
    }
  };
}

async function prepareToolCall(request: ToolRequest): Promise<PrepareToolResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { ok: false, code: "DISABLED", message: "Tool shim is disabled." };
  }

  let validated: ToolRequest;
  try {
    validated = validateToolRequest(request);
  } catch (error) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: error instanceof Error ? error.message : "Invalid tool request."
    };
  }

  const policy = getToolPolicy(validated.name);
  if (!policy || policy.mode === "deny") {
    return { ok: false, code: "TOOL_DENIED", message: `Tool ${validated.name} is not allowed.` };
  }

  if (validated.name === "browser.tab.read_text") {
    const targetTab = await chrome.tabs.get((validated.args as { tabId: number }).tabId);
    const url = targetTab.url ?? "";
    if (settings.sensitiveDomainBlocklist.some((fragment) => url.includes(fragment))) {
      return {
        ok: false,
        code: "SENSITIVE_TAB_BLOCKED",
        message: `Blocked page-read request for sensitive URL: ${url}`
      };
    }

    return {
      ok: true,
      decision: "confirm",
      request: validated,
      policy,
      confirmationText: `Allow page text read for tab ${targetTab.id}: ${targetTab.title ?? url}`
    };
  }

  if (validated.name === "local.mcp.call") {
    return {
      ok: true,
      decision: "confirm",
      request: validated,
      policy,
      confirmationText: "Allow localhost bridge tool execution?"
    };
  }

  return { ok: true, decision: "auto", request: validated, policy };
}

async function executeToolCall(request: ToolRequest): Promise<ToolResult> {
  const settings = await getSettings();
  try {
    const validated = validateToolRequest(request);
    const result = await executeToolRequest(validated, settings);
    await appendAuditLog(makeAuditEntry(validated, "success", "Execution completed."), settings);
    return {
      id: validated.id,
      name: validated.name,
      ok: true,
      result
    };
  } catch (error) {
    await appendAuditLog(
      makeAuditEntry(request, "error", error instanceof Error ? error.message : "Execution failed."),
      settings
    );
    return {
      id: request.id,
      name: request.name,
      ok: false,
      error: {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : "Execution failed."
      }
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBackgroundProbeSamples(): Promise<BackgroundProbeSample[]> {
  const stored = await chrome.storage.local.get(BACKGROUND_PROBE_STORAGE_KEY);
  const samples = stored[BACKGROUND_PROBE_STORAGE_KEY];
  return Array.isArray(samples) ? (samples as BackgroundProbeSample[]) : [];
}

async function storeBackgroundProbeSamples(samples: BackgroundProbeSample[]): Promise<void> {
  await chrome.storage.local.set({
    [BACKGROUND_PROBE_STORAGE_KEY]: samples.slice(-MAX_BACKGROUND_PROBE_SAMPLES)
  });
}

async function appendBackgroundProbeSample(sample: BackgroundProbeSample): Promise<void> {
  const samples = await getBackgroundProbeSamples();
  samples.push(sample);
  await storeBackgroundProbeSamples(samples);
}

async function getBackgroundModeState(): Promise<BackgroundModeState> {
  const stored = await chrome.storage.local.get(BACKGROUND_MODE_STORAGE_KEY);
  const state = stored[BACKGROUND_MODE_STORAGE_KEY] as BackgroundModeState | undefined;
  return state ?? { enabled: false };
}

async function storeBackgroundModeState(state: BackgroundModeState): Promise<void> {
  await chrome.storage.local.set({ [BACKGROUND_MODE_STORAGE_KEY]: state });
}

function isChatGptUrl(url: string): boolean {
  return url.startsWith("https://chatgpt.com/") || url.startsWith("https://chat.openai.com/");
}

async function captureBackgroundProbe(tabId: number): Promise<BackgroundProbeSample> {
  const timestamp = new Date().toISOString();
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const assistantMessages = Array.from(
          document.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]')
        );
        const latestAssistant = assistantMessages[assistantMessages.length - 1];
        const latestAssistantText = latestAssistant?.innerText?.trim() ?? "";

        return {
          visibility: document.visibilityState,
          focused: document.hasFocus(),
          readyState: document.readyState,
          assistantMessages: assistantMessages.length,
          userMessages: document.querySelectorAll('[data-message-author-role="user"]').length,
          latestAssistantLength: latestAssistantText.length,
          latestAssistantHasToolCall: /<tool_call\b/i.test(latestAssistantText)
        };
      }
    });

    const result = results[0]?.result;
    if (!result) {
      return {
        timestamp,
        tabId,
        ok: false,
        error: "executeScript returned no main-frame result."
      };
    }

    return {
      timestamp,
      tabId,
      ok: true,
      ...result
    };
  } catch (error) {
    return {
      timestamp,
      tabId,
      ok: false,
      error: error instanceof Error ? error.message : "Background executeScript probe failed."
    };
  }
}

async function requestBackgroundScan(tabId: number): Promise<void> {
  try {
    // Explicitly wake the content-script orchestration path. executeScript() can
    // inspect an unfocused tab, but that does not reliably schedule the page's
    // MutationObserver. A targeted extension message gives Background Mode a
    // deterministic scan trigger instead of relying on incidental DOM activity.
    await chrome.tabs.sendMessage(tabId, { type: "BACKGROUND_SCAN_NOW" });
  } catch {
    // The diagnostic probe remains authoritative for tab existence. A missing
    // receiver can occur transiently during navigation/reload; the next tick
    // retries without disabling Background Mode.
  }
}

async function runBackgroundProbeSeries(
  tabId: number,
  durationMs: number,
  intervalMs: number
): Promise<BackgroundProbeSample[]> {
  const boundedDurationMs = Math.max(5_000, Math.min(durationMs, 60_000));
  const boundedIntervalMs = Math.max(250, Math.min(intervalMs, 5_000));
  const samples: BackgroundProbeSample[] = [];

  await storeBackgroundProbeSamples(samples);
  const startedAt = Date.now();

  while (Date.now() - startedAt <= boundedDurationMs) {
    const sample = await captureBackgroundProbe(tabId);
    samples.push(sample);
    await storeBackgroundProbeSamples(samples);

    if (Date.now() - startedAt >= boundedDurationMs) {
      break;
    }
    await sleep(boundedIntervalMs);
  }

  return samples;
}

async function runBackgroundModeLoop(tabId: number, generation: number): Promise<void> {
  try {
    while (generation === backgroundLoopGeneration) {
      const state = await getBackgroundModeState();
      if (!state.enabled || state.tabId !== tabId) {
        break;
      }

      const sample = await captureBackgroundProbe(tabId);
      await appendBackgroundProbeSample(sample);
      await requestBackgroundScan(tabId);

      if (!sample.ok) {
        const tabStillExists = await chrome.tabs.get(tabId).then(
          () => true,
          () => false
        );
        if (!tabStillExists) {
          await storeBackgroundModeState({ enabled: false });
          break;
        }
      }

      await sleep(BACKGROUND_MODE_INTERVAL_MS);
    }
  } finally {
    if (generation === backgroundLoopGeneration && backgroundLoopTabId === tabId) {
      backgroundLoopTabId = null;
    }
  }
}

function ensureBackgroundModeLoop(tabId: number): void {
  if (backgroundLoopTabId === tabId) return;

  const generation = ++backgroundLoopGeneration;
  backgroundLoopTabId = tabId;
  void runBackgroundModeLoop(tabId, generation);
}

function stopBackgroundModeLoop(): void {
  backgroundLoopGeneration += 1;
  backgroundLoopTabId = null;
}

async function setBackgroundMode(
  enabled: boolean,
  sender: chrome.runtime.MessageSender
): Promise<BackgroundModeState> {
  if (!enabled) {
    stopBackgroundModeLoop();
    const state: BackgroundModeState = { enabled: false };
    await storeBackgroundModeState(state);
    return state;
  }

  const tabId = sender.tab?.id;
  const url = sender.tab?.url ?? "";
  if (tabId === undefined || !isChatGptUrl(url)) {
    throw new Error("Background Mode must be enabled from a ChatGPT tab.");
  }

  const state: BackgroundModeState = {
    enabled: true,
    tabId,
    url,
    startedAt: new Date().toISOString()
  };
  await storeBackgroundModeState(state);
  await storeBackgroundProbeSamples([]);
  ensureBackgroundModeLoop(tabId);
  return state;
}

async function getBackgroundModeStateForSender(
  sender: chrome.runtime.MessageSender
): Promise<BackgroundModeState> {
  const state = await getBackgroundModeState();
  if (!state.enabled) return state;

  return {
    ...state,
    enabled: state.tabId !== undefined && state.tabId === sender.tab?.id
  };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case "PING":
          sendResponse({ ok: true, pong: true });
          return;
        case "GET_SETTINGS":
          sendResponse(await getSettings());
          return;
        case "UPDATE_SETTINGS":
          sendResponse(await updateSettings(message.patch));
          return;
        case "GET_AUDIT_LOG":
          sendResponse(await getAuditLog());
          return;
        case "APPEND_AUDIT_LOG": {
          const settings = await getSettings();
          await appendAuditLog(message.entry, settings);
          sendResponse({ ok: true });
          return;
        }
        case "GET_BACKGROUND_PROBE_SAMPLES":
          sendResponse(await getBackgroundProbeSamples());
          return;
        case "RUN_BACKGROUND_PROBE": {
          const tabId = _sender.tab?.id;
          if (tabId === undefined) {
            sendResponse({
              ok: false,
              code: "NO_SENDER_TAB",
              message: "Background probe must be armed from a ChatGPT tab."
            });
            return;
          }

          const samples = await runBackgroundProbeSeries(
            tabId,
            message.durationMs ?? 30_000,
            message.intervalMs ?? 1_000
          );
          sendResponse({ ok: true, tabId, samples: samples.length });
          return;
        }
        case "GET_BACKGROUND_MODE_STATE":
          sendResponse(await getBackgroundModeStateForSender(_sender));
          return;
        case "SET_BACKGROUND_MODE":
          sendResponse(await setBackgroundMode(message.enabled, _sender));
          return;
        case "PREPARE_TOOL_CALL":
          sendResponse(
            await prepareToolCall(
              enrichRequestSource(
                {
                  id: message.call.id,
                  name: message.call.name as ToolRequest["name"],
                  args: message.call.args,
                  source: message.source
                },
                _sender
              )
            )
          );
          return;
        case "EXECUTE_TOOL_CALL": {
          const result = await executeToolCall(enrichRequestSource(message.request, _sender));
          sendResponse({ ...result, formatted: formatToolResult(result) });
          return;
        }
        default:
          sendResponse({
            ok: false,
            code: "UNKNOWN_MESSAGE",
            message: "Unsupported message type."
          });
          return;
      }
    } catch (error) {
      sendResponse({
        ok: false,
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected runtime error."
      });
    }
  })();

  return true;
});

void (async () => {
  const state = await getBackgroundModeState();
  if (!state.enabled || state.tabId === undefined) return;

  try {
    const tab = await chrome.tabs.get(state.tabId);
    if (isChatGptUrl(tab.url ?? "")) {
      ensureBackgroundModeLoop(state.tabId);
    } else {
      await storeBackgroundModeState({ enabled: false });
    }
  } catch {
    await storeBackgroundModeState({ enabled: false });
  }
})();