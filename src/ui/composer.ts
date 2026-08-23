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

export function submitComposer(): boolean {
  const composer = findComposer();
  const button = findSubmitButton();
  if (button && !button.disabled) {
    button.click();
    return true;
  }

  if (!composer) {
    return false;
  }

  composer.focus();
  const keyOptions: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13
  };

  composer.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
  composer.dispatchEvent(new KeyboardEvent("keypress", keyOptions));
  composer.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
  return true;
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

function inspectAttachmentReadiness(filename: string): AttachmentReadiness {
  const scope = findComposerScope() ?? document.body;
  const normalized = filename.toLowerCase();

  const filenameVisible = Array.from(scope.querySelectorAll<HTMLElement>("*")).some((element) => {
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

  const busy = Array.from(
    scope.querySelectorAll<HTMLElement>(
      '[aria-busy="true"], [role="progressbar"], [data-state="loading"], [data-loading="true"]'
    )
  ).some((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });

  return { filenameVisible, busy };
}

async function waitForAttachmentReady(filename: string, timeoutMs: number): Promise<number> {
  const startedAt = performance.now();
  let stablePolls = 0;

  while (performance.now() - startedAt < timeoutMs) {
    const state = inspectAttachmentReadiness(filename);
    if (state.filenameVisible && !state.busy) {
      stablePolls += 1;
      if (stablePolls >= 3) {
        return Math.round(performance.now() - startedAt);
      }
    } else {
      stablePolls = 0;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  throw new Error(`Attachment ${filename} did not reach a stable ready state within ${timeoutMs}ms.`);
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

  const readyAfterMs = await waitForAttachmentReady(file.name, options.timeoutMs ?? 30_000);
  return {
    filename: file.name,
    inputAccept: input.accept,
    readyAfterMs
  };
}
