import type { ExtensionSettings } from "../protocol/types";

const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  autoRunSafeTools: true,
  autoSubmitToolResults: false,
  localhostBridgeEnabled: false,
  localhostBridgeUrl: "http://127.0.0.1:3210/tool",
  sensitiveDomainBlocklist: [
    "mail.google.com",
    "outlook.office.com",
    "mail.yahoo.com",
    "bank",
    "paypal.com",
    "1password.com",
    "bitwarden.com",
    "chrome://",
    "edge://"
  ],
  maxAuditEntries: 200
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined)
  };
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
