import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isAuthorized, resolveServerToken } from "./auth";
import { registerCoreCapabilities } from "./providers/core";
import { CapabilityRegistry } from "./registry";
import type { ExecuteRequest } from "./types";

const HOST = "127.0.0.1";
const PORT = Number(process.env.CHATGPT_TOOL_SHIM_PORT ?? "3210");
const MAX_BODY_BYTES = 1024 * 1024;
const registry = new CapabilityRegistry();
registerCoreCapabilities(registry);
const auth = resolveServerToken();

function json(response: ServerResponse, status: number, value: unknown) {
  const body = JSON.stringify(value, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error("Request body exceeds 1 MiB limit.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireExecuteRequest(value: unknown): ExecuteRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.tool !== "string" || record.tool.trim() === "") {
    throw new Error("tool must be a non-empty string.");
  }
  return {
    tool: record.tool,
    args: record.args ?? {},
    call_id: typeof record.call_id === "string" ? record.call_id : undefined
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  const requestId = request.headers["x-chat-shim-call-id"]?.toString() || randomUUID();

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, {
      ok: true,
      service: "chatgpt-tool-shim-broker",
      protocol: "local-capability-broker/v1"
    });
    return;
  }

  if (!isAuthorized(request.headers, auth.token)) {
    json(response, 401, {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid broker token." }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/capabilities") {
    json(response, 200, { ok: true, capabilities: registry.list() });
    return;
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/v1/execute" || url.pathname === "/tool")
  ) {
    try {
      const parsed = requireExecuteRequest(await readJson(request));
      const callId = parsed.call_id || requestId;
      const result = await registry.execute(parsed.tool, parsed.args, {
        requestId: callId,
        remoteAddress: request.socket.remoteAddress ?? "unknown"
      });
      json(response, 200, { ok: true, call_id: callId, tool: parsed.tool, result });
    } catch (error) {
      const unknown = error instanceof Error && error.name === "UnknownCapabilityError";
      json(response, unknown ? 404 : 400, {
        ok: false,
        call_id: requestId,
        error: {
          code: unknown ? "UNKNOWN_CAPABILITY" : "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Broker request failed."
        }
      });
    }
    return;
  }

  json(response, 404, {
    ok: false,
    error: { code: "NOT_FOUND", message: "Unknown broker endpoint." }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ChatGPT Tool Shim broker listening on http://${HOST}:${PORT}`);
  if (auth.generated) {
    console.log("Generated ephemeral broker token (copy this into the extension):");
    console.log(auth.token);
  } else {
    console.log("Using broker token from CHATGPT_TOOL_SHIM_TOKEN.");
  }
});
