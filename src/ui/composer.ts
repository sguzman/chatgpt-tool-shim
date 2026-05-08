import { findComposer, findSubmitButton } from "./selectors";

function dispatchInput(element: HTMLElement | HTMLTextAreaElement) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function insertIntoComposer(text: string) {
  const composer = findComposer();
  if (!composer) {
    throw new Error("Could not find the ChatGPT composer.");
  }

  if (composer instanceof HTMLTextAreaElement) {
    const next = composer.value.trim() ? `${composer.value}\n\n${text}` : text;
    composer.value = next;
    dispatchInput(composer);
    return;
  }

  const next = composer.textContent?.trim() ? `${composer.textContent}\n\n${text}` : text;
  composer.textContent = next;
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
