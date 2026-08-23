import type { AuditLogEntry, ExtensionSettings, ToolRequest } from "../protocol/types";
import { renderLogEntries } from "./log_panel";

type OverlayCallbacks = {
  onToggleEnabled: (enabled: boolean) => void;
  onToggleAutoRun: (enabled: boolean) => void;
  onToggleAutoSubmit: (enabled: boolean) => void;
  onToggleAttachmentResults: (enabled: boolean) => void;
  onConfigureBroker: () => void;
  onRequestLog: () => void;
  onDownloadDiagnostics: () => void;
  onInsertPrompt: () => void;
  onInsertToolCatalog: () => void;
  onInsertHelloCall: () => void;
  onInsertClockCall: () => void;
  onConfirmRequest: () => void;
  onCancelRequest: () => void;
};

type OverlayState =
  | "idle"
  | "watching"
  | "running"
  | "packaging"
  | "attaching"
  | "submitting"
  | "confirm"
  | "error";

type OverlayStatus = {
  state: OverlayState;
  lastTool: string;
  lastError: string;
};

export type OverlayController = {
  setSettings: (settings: ExtensionSettings) => void;
  setStatus: (status: Partial<OverlayStatus>) => void;
  showConfirmation: (request: ToolRequest, message: string) => void;
  clearConfirmation: () => void;
  showLog: (entries: AuditLogEntry[]) => void;
};

export function createOverlay(callbacks: OverlayCallbacks): OverlayController {
  document.getElementById("chatgpt-tool-shim-root")?.remove();

  const root = document.createElement("div");
  root.id = "chatgpt-tool-shim-root";
  const shadow = root.attachShadow({ mode: "open" });
  document.documentElement.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .panel { position: fixed; right: 16px; bottom: 16px; width: 340px; z-index: 2147483647; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #f3f5f7; background: rgba(14, 19, 24, 0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.35); overflow: hidden; }
    .header, .body, .confirm, .log { padding: 10px 12px; }
    .header { font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, #1a2a3a, #183126); }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 6px 0; align-items: center; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; color: #0e1318; background: #d1f072; }
    button.secondary { background: #253241; color: #f3f5f7; }
    pre { margin: 0; white-space: pre-wrap; max-height: 220px; overflow: auto; }
    .muted { color: #9fb0bf; max-width: 210px; overflow-wrap: anywhere; text-align: right; }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header">Tool Shim · restart</div>
    <div class="body">
      <div class="row"><span>Enabled</span><button id="enabled" class="secondary"></button></div>
      <div class="row"><span>Auto Run Safe</span><button id="autorun" class="secondary"></button></div>
      <div class="row"><span>Auto Submit</span><button id="autosubmit" class="secondary"></button></div>
      <div class="row"><span>Attach Large Results</span><button id="attachments" class="secondary"></button></div>
      <div class="row"><span>Broker</span><span id="broker-status" class="muted">off</span></div>
      <div class="row"><span>Status</span><span id="status-text" class="muted">idle</span></div>
      <div class="row"><span>Last Tool</span><span id="last-tool" class="muted">none</span></div>
      <div class="row"><span>Last Error</span><span id="last-error" class="muted">none</span></div>
      <div class="buttons">
        <button id="configure-broker" class="secondary">Configure Broker</button>
        <button id="insert-prompt" class="secondary">Insert Prompt</button>
        <button id="insert-tools" class="secondary">Insert Tools</button>
        <button id="insert-hello" class="secondary">Insert Hello</button>
        <button id="insert-clock" class="secondary">Insert Clock</button>
        <button id="show-log" class="secondary">Open Log</button>
        <button id="diagnostics" class="secondary">Download Diagnostics</button>
      </div>
    </div>
    <div id="confirm" class="confirm" style="display:none">
      <div id="confirm-text"></div>
      <div class="buttons"><button id="confirm-run">Run</button><button id="confirm-cancel" class="secondary">Cancel</button></div>
    </div>
    <div id="log" class="log" style="display:none"><pre id="log-text"></pre></div>
  `;

  shadow.append(style, panel);

  const enabledButton = panel.querySelector<HTMLButtonElement>("#enabled")!;
  const autoRunButton = panel.querySelector<HTMLButtonElement>("#autorun")!;
  const autoSubmitButton = panel.querySelector<HTMLButtonElement>("#autosubmit")!;
  const attachmentsButton = panel.querySelector<HTMLButtonElement>("#attachments")!;
  const brokerStatus = panel.querySelector<HTMLElement>("#broker-status")!;
  const statusText = panel.querySelector<HTMLElement>("#status-text")!;
  const lastTool = panel.querySelector<HTMLElement>("#last-tool")!;
  const lastError = panel.querySelector<HTMLElement>("#last-error")!;
  const confirmBox = panel.querySelector<HTMLElement>("#confirm")!;
  const confirmText = panel.querySelector<HTMLElement>("#confirm-text")!;
  const logBox = panel.querySelector<HTMLElement>("#log")!;
  const logText = panel.querySelector<HTMLElement>("#log-text")!;

  panel.querySelector<HTMLButtonElement>("#configure-broker")!.addEventListener("click", callbacks.onConfigureBroker);
  panel.querySelector<HTMLButtonElement>("#show-log")!.addEventListener("click", callbacks.onRequestLog);
  panel.querySelector<HTMLButtonElement>("#diagnostics")!.addEventListener("click", callbacks.onDownloadDiagnostics);
  panel.querySelector<HTMLButtonElement>("#insert-prompt")!.addEventListener("click", callbacks.onInsertPrompt);
  panel.querySelector<HTMLButtonElement>("#insert-tools")!.addEventListener("click", callbacks.onInsertToolCatalog);
  panel.querySelector<HTMLButtonElement>("#insert-hello")!.addEventListener("click", callbacks.onInsertHelloCall);
  panel.querySelector<HTMLButtonElement>("#insert-clock")!.addEventListener("click", callbacks.onInsertClockCall);
  panel.querySelector<HTMLButtonElement>("#confirm-run")!.addEventListener("click", callbacks.onConfirmRequest);
  panel.querySelector<HTMLButtonElement>("#confirm-cancel")!.addEventListener("click", callbacks.onCancelRequest);

  let currentSettings: ExtensionSettings | null = null;
  let currentStatus: OverlayStatus = { state: "idle", lastTool: "none", lastError: "none" };

  function syncButtons() {
    if (!currentSettings) return;
    enabledButton.textContent = currentSettings.enabled ? "ON" : "OFF";
    autoRunButton.textContent = currentSettings.autoRunSafeTools ? "ON" : "OFF";
    autoSubmitButton.textContent = currentSettings.autoSubmitToolResults ? "ON" : "OFF";
    attachmentsButton.textContent = currentSettings.attachmentResultsEnabled ? "ON" : "OFF";
    brokerStatus.textContent = !currentSettings.localhostBridgeEnabled
      ? "off"
      : currentSettings.localhostBridgeToken
        ? "configured"
        : "missing token";
  }

  enabledButton.addEventListener("click", () => currentSettings && callbacks.onToggleEnabled(!currentSettings.enabled));
  autoRunButton.addEventListener("click", () => currentSettings && callbacks.onToggleAutoRun(!currentSettings.autoRunSafeTools));
  autoSubmitButton.addEventListener("click", () => currentSettings && callbacks.onToggleAutoSubmit(!currentSettings.autoSubmitToolResults));
  attachmentsButton.addEventListener("click", () => currentSettings && callbacks.onToggleAttachmentResults(!currentSettings.attachmentResultsEnabled));

  return {
    setSettings(nextSettings) {
      currentSettings = nextSettings;
      syncButtons();
    },
    setStatus(status) {
      currentStatus = { ...currentStatus, ...status };
      statusText.textContent = currentStatus.state;
      lastTool.textContent = currentStatus.lastTool;
      lastError.textContent = currentStatus.lastError;
    },
    showConfirmation(request, message) {
      confirmText.textContent = `${message} [${request.name}]`;
      confirmBox.style.display = "block";
      logBox.style.display = "none";
      this.setStatus({ state: "confirm", lastTool: request.name });
    },
    clearConfirmation() { confirmBox.style.display = "none"; },
    showLog(entries) {
      logText.textContent = renderLogEntries(entries);
      logBox.style.display = logBox.style.display === "none" ? "block" : "none";
    }
  };
}
