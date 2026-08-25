import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

export function resolveServerToken(): { token: string; generated: boolean } {
  const configured = process.env.CHATGPT_TOOL_SHIM_TOKEN?.trim();
  if (configured) {
    return { token: configured, generated: false };
  }
  return { token: randomBytes(32).toString("base64url"), generated: true };
}

export function isAuthorized(headers: IncomingHttpHeaders, expectedToken: string): boolean {
  const authorization = headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
