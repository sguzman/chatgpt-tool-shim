import type { AuditLogEntry } from "../protocol/types";

export function renderLogEntries(entries: AuditLogEntry[]): string {
  if (entries.length === 0) {
    return "No audit entries yet.";
  }

  return entries
    .map(
      (entry) =>
        `${entry.timestamp} | ${entry.outcome.toUpperCase()} | ${entry.toolName} | ${entry.target}\n${entry.detail}`
    )
    .join("\n\n");
}
