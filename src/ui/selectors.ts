function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  return element.getClientRects().length > 0;
}

export function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  const selectors = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[contenteditable="true"][contenteditable="true"]',
    '[contenteditable="true"][data-testid*="composer"]',
    '[contenteditable="true"][id*="prompt"]',
    '[contenteditable="true"][placeholder*="Ask"]',
    '[contenteditable="true"][aria-label*="Message"]',
    '[contenteditable="true"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Message"]',
    "textarea"
  ];

  for (const selector of selectors) {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement | HTMLTextAreaElement>(selector)
    );
    const element = elements.find((candidate) => isVisibleElement(candidate));
    if (element) {
      return element;
    }
  }

  return null;
}

export function findSubmitButton(): HTMLButtonElement | null {
  const selectors = [
    'button[data-testid*="send"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="submit"]',
    'button[data-testid*="submit"]',
    'button svg',
    'form button[type="submit"]',
    "form button:last-of-type"
  ];

  for (const selector of selectors) {
    const buttons =
      selector === "button svg"
        ? Array.from(document.querySelectorAll<SVGElement>(selector))
            .map((svg) => svg.closest("button"))
            .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement)
        : Array.from(document.querySelectorAll<HTMLButtonElement>(selector));
    const button = buttons.find((candidate) => isVisibleElement(candidate) && !candidate.disabled);
    if (button) {
      return button;
    }
  }

  return null;
}

export function findAssistantMessages(): HTMLElement[] {
  const direct = Array.from(
    document.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]')
  );

  if (direct.length > 0) {
    return direct;
  }

  return Array.from(document.querySelectorAll<HTMLElement>("main article"));
}

export function findLatestAssistantMessage(): HTMLElement | null {
  const messages = findAssistantMessages();
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

export function getAssistantMessageText(element: HTMLElement): string {
  return element.innerText?.trim() ?? "";
}
