import type {
  AuditLogEntry,
  BackgroundProbeSample,
  ExtensionSettings
} from "../protocol/types";
import {
  collectSelectorCandidateDiagnostics,
  findAttachmentInput,
  findAssistantMessages,
  findComposer,
  findComposerScope,
  findSubmitButton
} from "./selectors";

export type ToolTraceEvent = {
  timestamp: string;
  callId: string;
  toolName: string;
  state: string;
  detail?: string;
};

function describeElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    role: element.getAttribute("role"),
    ariaLabel: element.getAttribute("aria-label"),
    dataTestId: element.getAttribute("data-testid"),
    title: element.getAttribute("title"),
    classNames: Array.from(element.classList).slice(0, 12),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };
}

function sanitizeSettings(settings: ExtensionSettings) {
  return {
    enabled: settings.enabled,
    autoRunSafeTools: settings.autoRunSafeTools,
    autoSubmitToolResults: settings.autoSubmitToolResults,
    localhostBridgeEnabled: settings.localhostBridgeEnabled,
    localhostBridgeUrl: settings.localhostBridgeUrl,
    localhostBridgeTokenConfigured: Boolean(settings.localhostBridgeToken),
    sensitiveDomainBlocklistCount: settings.sensitiveDomainBlocklist.length,
    maxAuditEntries: settings.maxAuditEntries,
    attachmentResultsEnabled: settings.attachmentResultsEnabled,
    attachmentThresholdBytes: settings.attachmentThresholdBytes,
    attachmentUploadTimeoutMs: settings.attachmentUploadTimeoutMs
  };
}

export function collectDomDiagnostics() {
  const composer = findComposer();
  const scope = findComposerScope();
  const submit = findSubmitButton();
  const attachmentInput = findAttachmentInput();

  return {
    generatedAt: new Date().toISOString(),
    page: {
      url: location.href,
      origin: location.origin,
      pathname: location.pathname,
      title: document.title,
      readyState: document.readyState
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform
    },
    counts: {
      assistantMessages: findAssistantMessages().length,
      forms: document.forms.length,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      contentEditables: document.querySelectorAll('[contenteditable="true"]').length
    },
    selected: {
      composer: describeElement(composer),
      composerScope: describeElement(scope),
      submitButton: describeElement(submit),
      attachmentInput: describeElement(attachmentInput)
    },
    candidates: collectSelectorCandidateDiagnostics()
  };
}

export function buildExtensionDiagnostics(
  settings: ExtensionSettings,
  auditLog: AuditLogEntry[],
  trace: ToolTraceEvent[],
  backgroundProbe: BackgroundProbeSample[] = []
) {
  return {
    protocol: "chatgpt-tool-shim-extension-diagnostics/1",
    generatedAt: new Date().toISOString(),
    dom: collectDomDiagnostics(),
    settings: sanitizeSettings(settings),
    auditLog,
    trace,
    backgroundProbe
  };
}

export function downloadJsonFile(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
