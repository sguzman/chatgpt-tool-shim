import {
  findAttachmentInput,
  findComposer,
  findComposerScope,
  findSubmitButton
} from "./selectors";

function dispatchInput(element: HTMLElement | HTMLTextAreaElement) {
  element.dispatchEvent(new Event("focus", { bubbles: true }));
  element.dispatchEvent(
    new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText" })
  );
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function composerText(element: HTMLElement | HTMLTextAreaElement | null): string {
  if (!element) return "";
  return element instanceof HTMLTextAreaElement
    ? element.value.trim()
    : (element.textContent?.trim() ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout = 0;
    const observer = new MutationObserver(() => finish());

    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeout) window.clearTimeout(timeout);
      resolve();
    };

    // Background tabs can have aggressive timer throttling. Treat the timeout as
    // a deadline/fallback, but wake immediately when ChatGPT mutates the DOM.
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    timeout = window.setTimeout(finish, ms);
  });
}

export function insertIntoComposer(text: string) {
  const composer = findComposer();
  if (!composer) {
    throw new Error("Could not find the ChatGPT composer.");
  }

  if (composer instanceof HTMLTextAreaElement) {
    composer.focus();
    const next = composer.value.trim() ? `${composer.value}\n\n${text}` : text;
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    );
    descriptor?.set?.call(composer, next);
    dispatchInput(composer);
    return;
  }

  composer.focus();
  const current = composer.textContent?.trim() ?? "";
  const next = current ? `${current}\n\n${text}` : text;

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // execCommand remains the most compatible way to trigger editor transactions
  // across the contenteditable implementations ChatGPT has used historically.
  const prefix = current ? "\n\n" : "";
  const inserted = document.execCommand?.("insertText", false, `${prefix}${text}`);
  if (!inserted) {
    composer.textContent = next;
  }
  dispatchInput(composer);
}

export type SubmitMethod =
  | "focus-main-world-click"
  | "form-request-submit"
  | "mouse-events"
  | "keyboard-enter";

export type SubmitReceipt = {
  method: SubmitMethod;
  readyAfterMs: number;
  observedAfterMs: number;
  signal: "composer-cleared" | "user-message-added";
};

type FocusSubmitResponse =
  | { ok: true; method: "focus-main-world-click"; detail: string }
  | { ok: false; code: string; message: string };

function countUserMessages(): number {
  return document.querySelectorAll('[data-message-author-role="user"]').length;
}

function describeSubmitButton(button: HTMLButtonElement): string {
  const parts = [
    `tag=${button.tagName.toLowerCase()}`,
    `type=${button.type || "none"}`,
    `disabled=${button.disabled}`,
    `data-testid=${button.getAttribute("data-testid") ?? "none"}`,
    `aria-label=${button.getAttribute("aria-label") ?? "none"}`,
    `title=${button.getAttribute("title") ?? "none"}`,
    `form=${button.form ? "yes" : "no"}`
  ];
  return parts.join(", ");
}

async function waitForSubmitReady(timeoutMs: number): Promise<{
  button: HTMLButtonElement;
  composer: HTMLElement | HTMLTextAreaElement;
  readyAfterMs: number;
}> {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    const composer = findComposer();
    const button = findSubmitButton();
    if (composer && composerText(composer).length > 0 && button && !button.disabled) {
      return {
        button,
        composer,
        readyAfterMs: Math.round(performance.now() - startedAt)
      };
    }
    await sleep(50);
  }

  throw new Error(`ChatGPT submit control did not become ready within ${timeoutMs}ms.`);
}

async function waitForSubmissionObserved(
  initialUserMessageCount: number,
  timeoutMs: number
): Promise<{ observedAfterMs: number; signal: SubmitReceipt["signal"] } | null> {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    const current = findComposer();
    if (current && composerText(current).length === 0) {
      return {
        observedAfterMs: Math.round(performance.now() - startedAt),
        signal: "composer-cleared"
      };
    }

    if (countUserMessages() > initialUserMessageCount) {
      return {
        observedAfterMs: Math.round(performance.now() - startedAt),
        signal: "user-message-added"
      };
    }

    await sleep(50);
  }

  return null;
}

function requestFormSubmit(button: HTMLButtonElement, composer: HTMLElement | HTMLTextAreaElement) {
  const form = button.form ?? composer.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Selected ChatGPT send control is not associated with a form.");
  }

  if (button.form === form && button.type === "submit") {
    form.requestSubmit(button);
  } else {
    form.requestSubmit();
  }
}

function dispatchMouseActivation(button: HTMLButtonElement) {
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 1,
    view: window
  };

  button.dispatchEvent(new MouseEvent("mousedown", init));
  button.dispatchEvent(new MouseEvent("mouseup", { ...init, buttons: 0 }));
  button.dispatchEvent(new MouseEvent("click", { ...init, buttons: 0 }));
}

function dispatchEnter(composer: HTMLElement | HTMLTextAreaElement) {
  composer.focus();
  const init: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13
  };

  composer.dispatchEvent(new KeyboardEvent("keydown", init));
  composer.dispatchEvent(new KeyboardEvent("keypress", init));
  composer.dispatchEvent(new KeyboardEvent("keyup", init));
}

function composerHasAttachment(): boolean {
  const input = findAttachmentInput();
  if (input?.files?.length) return true;

  const scope = findComposerScope();
  if (!scope) return false;
  return Boolean(
    scope.querySelector(
      '[data-testid*="attachment"], [data-testid*="file"], [aria-label*="attachment" i], [aria-label*="file" i]'
    )
  );
}

async function activateFocusAssistedSubmit(): Promise<string> {
  const response = (await chrome.runtime.sendMessage({
    type: "ACTIVATE_CHATGPT_SUBMIT_WITH_FOCUS"
  })) as FocusSubmitResponse;

  if (!response?.ok) {
    throw new Error(
      response
        ? `${response.code}: ${response.message}`
        : "Focus-assisted submit activation returned no response."
    );
  }

  return response.detail;
}

export async function submitComposer(
  options: { readyTimeoutMs?: number; observeTimeoutMs?: number } = {}
): Promise<SubmitReceipt> {
  const { button, composer, readyAfterMs } = await waitForSubmitReady(
    options.readyTimeoutMs ?? 5_000
  );
  const initialUserMessageCount = countUserMessages();
  const hasAttachment = composerHasAttachment();
  // Attachment-bearing sends have a slower page-side acknowledgement path than
  // ordinary text sends. Preserve the caller's timeout for text, but never use
  // the short text timeout when a file is present.
  const requestedObserveTimeoutMs = options.observeTimeoutMs ?? 1_750;
  const observeTimeoutMs = hasAttachment
    ? Math.max(requestedObserveTimeoutMs, 5_000)
    : requestedObserveTimeoutMs;
  const attempts: string[] = [];

  const methods: Array<{
    method: SubmitMethod;
    run: () => void | string | Promise<void | string>;
  }> = [];

  // Live Edge testing has already shown that isolated-world activation and a
  // native MAIN-world button.click() are both ignored for a ready attachment
  // while ChatGPT is unfocused. The next narrow experiment briefly focuses the
  // ChatGPT window, invokes that same strict MAIN-world click, then relinquishes
  // the window before falling back to the ordinary activation ladder.
  if (hasAttachment && !document.hasFocus()) {
    methods.push({
      method: "focus-main-world-click",
      run: () => activateFocusAssistedSubmit()
    });
  }

  methods.push(
    {
      method: "form-request-submit",
      run: () => requestFormSubmit(button, composer)
    },
    {
      method: "mouse-events",
      run: () => dispatchMouseActivation(button)
    },
    {
      method: "keyboard-enter",
      run: () => dispatchEnter(findComposer() ?? composer)
    }
  );

  for (const attempt of methods) {
    try {
      const detail = await attempt.run();
      attempts.push(`${attempt.method}: invoked${detail ? ` (${detail})` : ""}`);
    } catch (error) {
      attempts.push(
        `${attempt.method}: ${error instanceof Error ? error.message : "activation failed"}`
      );
      continue;
    }

    const observed = await waitForSubmissionObserved(initialUserMessageCount, observeTimeoutMs);
    if (observed) {
      return {
        method: attempt.method,
        readyAfterMs,
        observedAfterMs: observed.observedAfterMs,
        signal: observed.signal
      };
    }

    attempts.push(`${attempt.method}: no submission signal within ${observeTimeoutMs}ms`);
  }

  throw new Error(
    `ChatGPT auto-submit failed after all activation methods. ` +
      `Selected control: ${describeSubmitButton(button)}. Attempts: ${attempts.join(" | ")}`
  );
}

export type AttachmentReceipt = {
  filename: string;
  inputAccept: string;
  readyAfterMs: number;
};

type AttachmentReadiness = {
  filenameVisible: boolean;
  busy: boolean;
};

function elementLooksBusy(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;

  if (
    element.getAttribute("aria-busy") === "true" ||
    element.getAttribute("role") === "progressbar" ||
    element.getAttribute("data-state") === "loading" ||
    element.getAttribute("data-loading") === "true"
  ) {
    return true;
  }

  const descriptor = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-state"),
    element.getAttribute("data-testid"),
    element.childElementCount <= 4 ? element.textContent : null
  ]
    .filter(Boolean)
    .join(" ");

  return /\b(uploading|processing|attaching)\b/i.test(descriptor);
}

function inspectAttachmentReadiness(filename: string): AttachmentReadiness {
  const scope = findComposerScope() ?? document.body;
  const normalized = filename.toLowerCase();

  const filenameMatches = Array.from(scope.querySelectorAll<HTMLElement>("*")).filter((element) => {
    const descriptor = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.childElementCount === 0 ? element.textContent : null
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return descriptor.includes(normalized);
  });

  const filenameVisible = filenameMatches.length > 0;

  const genericBusy = Array.from(
    scope.querySelectorAll<HTMLElement>(
      '[aria-busy="true"], [role="progressbar"], [data-state="loading"], [data-loading="true"]'
    )
  ).some(elementLooksBusy);

  const attachmentBusy = filenameMatches.some((match) => {
    let current: HTMLElement | null = match;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (elementLooksBusy(current)) return true;
      const nestedBusy = Array.from(current.querySelectorAll<HTMLElement>("*")).some(elementLooksBusy);
      if (nestedBusy) return true;
      current = current.parentElement;
    }
    return false;
  });

  return { filenameVisible, busy: genericBusy || attachmentBusy };
}

function minimumAttachmentStableMs(fileSize: number): number {
  if (fileSize > 1024 * 1024) return 5_000;
  if (fileSize > 256 * 1024) return 3_000;
  return 1_500;
}

async function waitForAttachmentReady(
  filename: string,
  fileSize: number,
  timeoutMs: number
): Promise<number> {
  const startedAt = performance.now();
  const minimumStableMs = minimumAttachmentStableMs(fileSize);
  let stableSince: number | null = null;

  while (performance.now() - startedAt < timeoutMs) {
    const now = performance.now();
    const state = inspectAttachmentReadiness(filename);
    if (state.filenameVisible && !state.busy) {
      stableSince ??= now;
      // `sleep()` intentionally wakes on arbitrary DOM mutation so hidden tabs
      // remain responsive. Therefore readiness must be measured in elapsed wall
      // time, not a count of successful polls: three DOM mutations can occur in
      // only a few milliseconds while a real upload is still in flight.
      if (now - stableSince >= minimumStableMs) {
        return Math.round(now - startedAt);
      }
    } else {
      stableSince = null;
    }

    await sleep(250);
  }

  throw new Error(
    `Attachment ${filename} did not remain visibly ready and non-busy for ` +
      `${minimumStableMs}ms within ${timeoutMs}ms.`
  );
}

export async function attachFileToComposer(
  file: File,
  options: { timeoutMs?: number } = {}
): Promise<AttachmentReceipt> {
  const input = findAttachmentInput();
  if (!input) {
    throw new Error("Could not find a ChatGPT file attachment input.");
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  const readyAfterMs = await waitForAttachmentReady(
    file.name,
    file.size,
    options.timeoutMs ?? 30_000
  );
  return {
    filename: file.name,
    inputAccept: input.accept,
    readyAfterMs
  };
}
