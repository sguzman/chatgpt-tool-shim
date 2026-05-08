import { findComposer, findSubmitButton } from "./selectors";

function dispatchInput(element: HTMLElement | HTMLTextAreaElement) {
  element.dispatchEvent(new Event("focus", { bubbles: true }));
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

  // Prefer the editing command path first because many composer implementations
  // are wired to browser editing events rather than direct DOM mutation.
  const inserted = document.execCommand?.("insertText", false, next);
  if (!inserted) {
    composer.textContent = next;
  }
  dispatchInput(composer);
}

export function submitComposer(): boolean {
  const button = findSubmitButton();
  if (!button || button.disabled) {
    return false;
  }
  button.click();
  return true;
}
