# Extension Diagnostics Export

The Tool Shim overlay exposes **Download Diagnostics** during the restart.

The exported `extension-diagnostics-*.json` contains structural/browser diagnostics intended to explain the adapter state:

- current page URL/title and browser metadata;
- counts of assistant messages, forms, file inputs, and contenteditable elements;
- selected composer, composer scope, submit button, and attachment-input metadata;
- selector candidate counts;
- non-secret extension settings;
- extension audit-log entries;
- a bounded call-correlated state trace such as `DETECTED`, `VALIDATED`, `ATTACHING`, `ATTACHMENT_READY`, and `SUBMITTED`.

It intentionally does **not** export assistant message text, composer text, page HTML, cookies, local/session storage, browser profile data, arbitrary filesystem content, or the localhost broker bearer token.

## Sharing with the project debug bundle

1. Click **Download Diagnostics** in the Tool Shim overlay.
2. Inspect the JSON if the session involved sensitive resource names.
3. Copy the JSON into the repository's `debug-input/` directory.
4. Run:

```powershell
npm run debug:bundle
```

5. Share the ZIP from `debug-bundles/`.

The PowerShell collector copies `debug-input/` verbatim so future extension exports can be added without changing the collector for every diagnostic type.
