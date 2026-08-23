import type { ExtensionSettings } from "../protocol/types";

export async function localMcpCall(
  args: { tool: string; args: unknown },
  settings: ExtensionSettings,
  callId: string
) {
  if (!settings.localhostBridgeEnabled) {
    throw new Error("Localhost bridge is disabled.");
  }
  if (!settings.localhostBridgeToken) {
    throw new Error("Localhost bridge token is not configured.");
  }

  const response = await fetch(settings.localhostBridgeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.localhostBridgeToken}`,
      "x-chat-shim-call-id": callId
    },
    body: JSON.stringify({ ...args, call_id: callId })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Local bridge request failed with status ${response.status}${detail ? `: ${detail}` : "."}`
    );
  }

  return await response.json();
}
