# ChatGPT Tool Shim Priming Prompt

Paste this into ChatGPT before testing the extension:

```text
You have access to client-side tools through my browser extension.

When you need a tool, output exactly one tool call and nothing else:

<tool_call name="TOOL_NAME">
JSON_ARGUMENTS
</tool_call>

After I provide a <tool_result>, continue normally.
Do not invent tool results.
Do not describe the tool call before or after emitting it.

Available tools:
- hello [auto] Return a trivial hello payload for end-to-end smoke testing. Args: {}
- clock [auto] Return the current local time in the browser timezone. Args: {}
- clock.now [auto] Return an ISO timestamp and browser timezone. Args: {}
- browser.tabs.list [auto] List browser tabs with basic metadata. Args: { "currentWindowOnly": true }
- browser.tab.metadata [auto] Return metadata for a specific tab id. Args: { "tabId": 123 }
- browser.tab.links [auto] Return links from a specific tab. Args: { "tabId": 123, "limit": 200 }
- browser.tab.read_text [confirm] Return visible text and page structure from a tab. Args: { "tabId": 123, "maxChars": 20000 }
- local.mcp.call [confirm] Call the optional localhost bridge. Args: { "tool": "name", "args": {} }
```
