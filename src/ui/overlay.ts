import type { AuditLogEntry, ExtensionSettings, ToolRequest } from "../protocol/types";
import { renderLogEntries } from "./log_panel";

const OVERLAY_POSITION_KEY = "chatgpt-tool-shim-overlay-position-v1";
const OVERLAY_MINIMIZED_KEY = "chatgpt-tool-shim-overlay-minimized-v1";

type OverlayCallbacks = {
  onToggleEnabled: (enabled: boolean) => void;
  onToggleAutoRun: (enabled: boolean) => void;
  onToggleAutoSubmit: (enabled: boolean) => void;
  onToggleAttachmentResults: (enabled: boolean) => void;
  onConfigureBroker: () => void;
  onRequestLog: () => void;
  onDownloadDiagnostics: () => void;
  onRunBackgroundProbe: () => void;
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
  | "probing"
  | "confirm"
  | "error";

type OverlayStatus = {
  state: OverlayState;
  lastTool: string;
  lastError: string;
};

type OverlayPosition = {
  left: number;
  top: number;
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
    @keyframes shim-confirm-pulse {
      0%, 100% { box-shadow: 0 12px 36px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,184,77,0.35); }
      50% { box-shadow: 0 12px 36px rgba(0,0,0,0.35), 0 0 0 5px rgba(255,184,77,0.22); }
    }
    .panel { position: fixed; right: 16px; bottom: 16px; width: 340px; z-index: 2147483647; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #f3f5f7; background: rgba(14, 19, 24, 0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.35); overflow: hidden; }
    .panel.minimized { width: 245px; }
    .panel.minimized .body, .panel.minimized .log { display: none !important; }
    .panel.minimized:not(.awaiting-confirmation) .confirm { display: none !important; }
    .panel.minimized.awaiting-confirmation { width: 300px; }
    .panel.awaiting-confirmation { border-color: rgba(255,184,77,0.95); animation: shim-confirm-pulse 1.2s ease-in-out infinite; }
    .header, .body, .confirm, .log { padding: 10px 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.12); background: linear-gradient(135deg, #1a2a3a, #183126); cursor: move; user-select: none; touch-action: none; }
    .header.dragging { cursor: grabbing; }
    .header-controls { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .attention-badge { display: none; padding: 2px 6px; border-radius: 999px; background: #ffb84d; color: #17120a; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; }
    .panel.awaiting-confirmation .attention-badge { display: inline-block; }
    .minimize-button { width: 28px; height: 24px; padding: 0; border-radius: 6px; background: #253241; color: #f3f5f7; font-size: 15px; line-height: 1; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 6px 0; align-items: center; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    button { border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; color: #0e1318; background: #d1f072; }
    button.secondary { background: #253241; color: #f3f5f7; }
    pre { margin: 0; white-space: pre-wrap; max-height: 220px; overflow: auto; }
    .muted { color: #9fb0bf; max-width: 210px; overflow-wrap: anywhere; text-align: right; }
    .confirm { border-top: 1px solid rgba(255,184,77,0.45); background: rgba(87,58,12,0.36); }
    .confirm-title { margin-bottom: 6px; color: #ffd18a; font-weight: 800; letter-spacing: 0.04em; }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header" title="Drag to move Tool Shim">
      <span>Tool Shim · restart</span>
      <span class="header-controls">
        <span class="attention-badge">ACTION REQUIRED</span>
        <button id="minimize" class="minimize-button" type="button" aria-label="Minimize Tool Shim" title="Minimize Tool Shim">−</button>
      </span>
    </div>
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
        <button id="background-probe" class="secondary">Arm BG Probe 30s</button>
        <button id="insert-prompt" class="secondary">Insert Prompt</button>
        <button id="insert-tools" class="secondary">Insert Tools</button>
        <button id="insert-hello" class="secondary">Insert Hello</button>
        <button id="insert-clock" class="secondary">Insert Clock</button>
        <button id="show-log" class="secondary">Open Log</button>
        <button id="diagnostics" class="secondary">Download Diagnostics</button>
      </div>
    </div>
    <div id="confirm" class="confirm" style="display:none">
      <div class="confirm-title">Permission required</div>
      <div id="confirm-text"></div>
      <div class="buttons"><button id="confirm-run">Run</button><button id="confirm-cancel" class="secondary">Cancel</button></div>
    </div>
    <div id="log" class="log" style="display:none"><pre id="log-text"></pre></div>
  `;

  shadow.append(style, panel);

  const header = panel.querySelector<HTMLElement>(".header")!;
  const minimizeButton = panel.querySelector<HTMLButtonElement>("#minimize")!;
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

  function clampPosition(left: number, top: number): OverlayPosition {
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    return {
      left: Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin))
    };
  }

  function setPanelPosition(left: number, top: number, persist: boolean) {
    const next = clampPosition(left, top);
    panel.style.left = `${Math.round(next.left)}px`;
    panel.style.top = `${Math.round(next.top)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    if (persist) {
      try {
        localStorage.setItem(OVERLAY_POSITION_KEY, JSON.stringify(next));
      } catch {
        // Position persistence is a convenience only; dragging still works without storage.
      }
    }
  }

  function restorePanelPosition() {
    try {
      const raw = localStorage.getItem(OVERLAY_POSITION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OverlayPosition>;
      if (typeof parsed.left === "number" && typeof parsed.top === "number") {
        window.requestAnimationFrame(() => setPanelPosition(parsed.left!, parsed.top!, false));
      }
    } catch {
      // Ignore corrupt or unavailable persisted position data.
    }
  }

  let minimized = false;

  function syncMinimizedState(persist: boolean) {
    panel.classList.toggle("minimized", minimized);
    minimizeButton.textContent = minimized ? "+" : "−";
    const label = minimized ? "Expand Tool Shim" : "Minimize Tool Shim";
    minimizeButton.setAttribute("aria-label", label);
    minimizeButton.title = label;

    if (persist) {
      try {
        localStorage.setItem(OVERLAY_MINIMIZED_KEY, minimized ? "1" : "0");
      } catch {
        // Minimized-state persistence is a convenience only.
      }
    }

    window.requestAnimationFrame(() => {
      if (panel.style.left && panel.style.top) {
        const rect = panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top, false);
      }
    });
  }

  function restoreMinimizedState() {
    try {
      minimized = localStorage.getItem(OVERLAY_MINIMIZED_KEY) === "1";
    } catch {
      minimized = false;
    }
    syncMinimizedState(false);
  }

  let drag:
    | {
        pointerId: number;
        offsetX: number;
        offsetY: number;
      }
    | null = null;

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    header.classList.add("dragging");
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  header.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPanelPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, false);
  });

  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = panel.getBoundingClientRect();
    setPanelPosition(rect.left, rect.top, true);
    drag = null;
    header.classList.remove("dragging");
    if (header.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
  };

  header.addEventListener("pointerup", finishDrag);
  header.addEventListener("pointercancel", finishDrag);

  minimizeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
  minimizeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    minimized = !minimized;
    syncMinimizedState(true);
  });

  window.addEventListener("resize", () => {
    if (panel.style.left && panel.style.top) {
      const rect = panel.getBoundingClientRect();
      setPanelPosition(rect.left, rect.top, false);
    }
  });

  restoreMinimizedState();
  restorePanelPosition();

  panel.querySelector<HTMLButtonElement>("#configure-broker")!.addEventListener("click", callbacks.onConfigureBroker);
  panel.querySelector<HTMLButtonElement>("#background-probe")!.addEventListener("click", callbacks.onRunBackgroundProbe);
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
      panel.classList.add("awaiting-confirmation");
      logBox.style.display = "none";
      this.setStatus({ state: "confirm", lastTool: request.name });
      window.requestAnimationFrame(() => {
        if (panel.style.left && panel.style.top) {
          const rect = panel.getBoundingClientRect();
          setPanelPosition(rect.left, rect.top, false);
        }
      });
    },
    clearConfirmation() {
      confirmBox.style.display = "none";
      panel.classList.remove("awaiting-confirmation");
      window.requestAnimationFrame(() => {
        if (panel.style.left && panel.style.top) {
          const rect = panel.getBoundingClientRect();
          setPanelPosition(rect.left, rect.top, false);
        }
      });
    },
    showLog(entries) {
      logText.textContent = renderLogEntries(entries);
      logBox.style.display = logBox.style.display === "none" ? "block" : "none";
    }
  };
}
