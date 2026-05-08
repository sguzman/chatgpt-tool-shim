export function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  return (
    document.querySelector<HTMLTextAreaElement>("textarea") ||
    document.querySelector<HTMLElement>('[contenteditable="true"][role="textbox"]') ||
    document.querySelector<HTMLElement>('[contenteditable="true"]')
  );
}

export function findSubmitButton(): HTMLButtonElement | null {
  return (
    document.querySelector<HTMLButtonElement>('button[data-testid*="send"]') ||
    document.querySelector<HTMLButtonElement>('button[aria-label*="Send"]') ||
    document.querySelector<HTMLButtonElement>("form button:last-of-type")
  );
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
