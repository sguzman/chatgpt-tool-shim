import { describe, expect, test } from "vitest";

import { formatToolResult } from "../src/protocol/format_tool_result";
import { hashString, parseLatestToolCall, stripFencedCodeBlocks } from "../src/protocol/parse_tool_calls";
import { buildPrimingPrompt, buildToolCatalogText } from "../src/protocol/tool_catalog";
import { validateToolRequest } from "../src/protocol/validate";

describe("parseLatestToolCall", () => {
  test("parses a valid tool call", () => {
    const parsed = parseLatestToolCall(`<tool_call name="clock.now">\n{}\n</tool_call>`);
    expect(parsed?.name).toBe("clock.now");
    expect(parsed?.args).toEqual({});
    expect(parsed?.id).toMatch(/^call_/);
  });

  test("rejects malformed json", () => {
    const parsed = parseLatestToolCall(`<tool_call name="clock.now">\n{broken}\n</tool_call>`);
    expect(parsed).toBeNull();
  });

  test("rejects incomplete calls", () => {
    const parsed = parseLatestToolCall(`<tool_call name="clock.now">\n{}`);
    expect(parsed).toBeNull();
  });

  test("ignores fenced code blocks", () => {
    const parsed = parseLatestToolCall("```xml\n<tool_call name=\"clock.now\">{}</tool_call>\n```");
    expect(parsed).toBeNull();
  });

  test("requires the call to be the full message body", () => {
    const parsed = parseLatestToolCall(
      `Here is a demo\n<tool_call name="clock.now">\n{}\n</tool_call>`
    );
    expect(parsed).toBeNull();
  });
});

describe("helpers", () => {
  test("stripFencedCodeBlocks removes triple backtick blocks", () => {
    expect(stripFencedCodeBlocks("a\n```js\nb\n```\nc")).toBe("a\n\nc");
  });

  test("hashString is stable", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
  });
});

describe("formatToolResult", () => {
  test("formats success result", () => {
    const text = formatToolResult({
      id: "1",
      name: "clock.now",
      ok: true,
      result: { now: "x" }
    });
    expect(text).toContain("<tool_result");
    expect(text).toContain('"ok": true');
  });
});

describe("tool catalog", () => {
  test("buildToolCatalogText includes starter tools", () => {
    const text = buildToolCatalogText();
    expect(text).toContain("hello");
    expect(text).toContain("clock");
    expect(text).toContain("browser.tab.read_text");
  });

  test("buildPrimingPrompt includes tool protocol", () => {
    const text = buildPrimingPrompt();
    expect(text).toContain("<tool_call name=\"TOOL_NAME\">");
    expect(text).toContain("Available tools:");
  });
});

describe("validateToolRequest", () => {
  test("normalizes hello args", () => {
    const request = validateToolRequest({
      id: "1",
      name: "hello",
      args: {},
      source: { chatTabId: 1, chatUrl: "https://chatgpt.com", assistantMessageKey: "a" }
    });
    expect(request.args).toEqual({});
  });

  test("normalizes clock args", () => {
    const request = validateToolRequest({
      id: "1",
      name: "clock",
      args: {},
      source: { chatTabId: 1, chatUrl: "https://chatgpt.com", assistantMessageKey: "a" }
    });
    expect(request.args).toEqual({});
  });

  test("normalizes browser.tabs.list defaults", () => {
    const request = validateToolRequest({
      id: "1",
      name: "browser.tabs.list",
      args: {},
      source: { chatTabId: 1, chatUrl: "https://chatgpt.com", assistantMessageKey: "a" }
    });
    expect(request.args).toEqual({ currentWindowOnly: true });
  });

  test("rejects unknown tools", () => {
    expect(() =>
      validateToolRequest({
        id: "1",
        name: "bad.tool" as never,
        args: {},
        source: { chatTabId: 1, chatUrl: "https://chatgpt.com", assistantMessageKey: "a" }
      })
    ).toThrow(/Unknown tool/);
  });
});
