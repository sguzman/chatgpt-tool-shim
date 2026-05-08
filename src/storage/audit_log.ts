import type { AuditLogEntry, ExtensionSettings } from "../protocol/types";

const AUDIT_LOG_KEY = "auditLog";

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const stored = await chrome.storage.local.get(AUDIT_LOG_KEY);
  return (stored[AUDIT_LOG_KEY] as AuditLogEntry[] | undefined) ?? [];
}

export async function appendAuditLog(
  entry: AuditLogEntry,
  settings: ExtensionSettings
): Promise<void> {
  const existing = await getAuditLog();
  const next = [entry, ...existing].slice(0, settings.maxAuditEntries);
  await chrome.storage.local.set({ [AUDIT_LOG_KEY]: next });
}
