# M4 — MCP Registry and Ontology

## Goal

Turn the broker from a fixed local-tool endpoint into a provider registry with progressive capability discovery.

## Checklist

- [ ] Define provider interface.
- [ ] Define provider lifecycle states.
- [ ] Register native provider(s).
- [ ] Register one MCP server.
- [ ] Normalize MCP tool schemas into capability records.
- [ ] Preserve original provider/tool identity for provenance.
- [ ] Define ontology path format.
- [ ] Add aliases/tags.
- [ ] Implement `capabilities.search`.
- [ ] Implement `capabilities.describe`.
- [ ] Avoid injecting the entire registry into normal ChatGPT context.
- [ ] Support filtered discovery by provider.
- [ ] Support filtered discovery by ontology path.
- [ ] Support filtered discovery by risk class.
- [ ] Expose provider health/state.
- [ ] Handle provider startup failure.
- [ ] Handle MCP disconnection/restart.
- [ ] Add registry summary to debug bundle.

## Exit condition

ChatGPT can discover a relevant MCP-backed capability without being preloaded with every registered tool schema, then invoke it through the broker.
