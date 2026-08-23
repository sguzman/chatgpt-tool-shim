import type {
  CapabilityContext,
  CapabilityDefinition,
  CapabilityDescriptor
} from "./types";

export class CapabilityRegistry {
  readonly #capabilities = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition) {
    if (this.#capabilities.has(definition.name)) {
      throw new Error(`Capability already registered: ${definition.name}`);
    }
    this.#capabilities.set(definition.name, definition);
  }

  list(): CapabilityDescriptor[] {
    return Array.from(this.#capabilities.values())
      .map(({ execute: _execute, ...descriptor }) => descriptor)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async execute(name: string, args: unknown, context: CapabilityContext): Promise<unknown> {
    const capability = this.#capabilities.get(name);
    if (!capability) {
      const error = new Error(`Unknown capability: ${name}`);
      error.name = "UnknownCapabilityError";
      throw error;
    }
    return await capability.execute(args ?? {}, context);
  }
}
