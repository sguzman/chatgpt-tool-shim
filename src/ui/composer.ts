import { findComposer, findSubmitButton } from "./selectors";

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

  if (document.activeElement !== composer) {
    composer.focus();
  }

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Prefer appending just the requested text into the live editor rather than
  // replacing the whole content, because modern composer UIs often bind to the
  // editing transaction instead of raw textContent changes.
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
