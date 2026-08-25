export type CapabilityRisk = "none" | "read" | "write" | "execute";

export type CapabilityContext = {
  requestId: string;
  remoteAddress: string;
};

export type CapabilityDefinition = {
  name: string;
  description: string;
  risk: CapabilityRisk;
  inputSchema: Record<string, unknown>;
  execute: (args: unknown, context: CapabilityContext) => Promise<unknown> | unknown;
};

export type CapabilityDescriptor = Omit<CapabilityDefinition, "execute">;

export type ExecuteRequest = {
  tool: string;
  args?: unknown;
  call_id?: string;
};
