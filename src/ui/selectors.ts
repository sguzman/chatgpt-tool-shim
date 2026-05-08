export function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  const selectors = [
    "textarea",
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Message"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][data-testid*="composer"]',
    '[contenteditable="true"][id*="prompt"]',
    '[contenteditable="true"][placeholder*="Ask"]',
    '[contenteditable="true"][aria-label*="Message"]',
    '[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement | HTMLTextAreaElement>(selector);
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
    'form button[type="submit"]',
    "form button:last-of-type"
  ];

  for (const selector of selectors) {
    const button = document.querySelector<HTMLButtonElement>(selector);
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
