import { formatToolResult } from "./protocol/format_tool_result";
import type {
  AuditLogEntry,
  PrepareToolResponse,
  RuntimeMessage,
  ToolRequest,
  ToolResult
} from "./protocol/types";
import { validateToolRequest } from "./protocol/validate";
import { appendAuditLog, getAuditLog } from "./storage/audit_log";
import { getSettings, updateSettings } from "./storage/settings";
import { executeToolRequest, getToolPolicy } from "./tools/index";

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
