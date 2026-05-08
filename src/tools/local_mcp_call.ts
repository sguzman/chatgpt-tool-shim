import type { ExtensionSettings } from "../protocol/types";

export async function localMcpCall(
  args: { tool: string; args: unknown },
  settings: ExtensionSettings
) {
  if (!settings.localhostBridgeEnabled) {
    throw new Error("Localhost bridge is disabled.");
  }

  const response = await fetch(settings.localhostBridgeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args)
  });

  if (!response.ok) {
    throw new Error(`Local bridge request failed with status ${response.status}.`);
  }

  return await response.json();
}
