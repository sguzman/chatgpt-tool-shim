const COMPOSER_SELECTORS = [
  '#prompt-textarea',
  '[data-testid="composer-text-input"]',
  '[data-testid*="composer"] [contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][data-lexical-editor="true"][role="textbox"]',
  '[contenteditable="true"][role="textbox"]',
  'textarea[placeholder*="Ask"]',
  'textarea[placeholder*="Message"]'
] as const;

const SUBMIT_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]'
] as const;

const ATTACHMENT_INPUT_SELECTORS = [
  'input[type="file"][multiple]',
  'input[type="file"]'
] as const;

export type SelectorCandidateDiagnostic = {
  selector: string;
  count: number;
  visibleCount: number;
};

export function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  return element.getClientRects().length > 0;
}

function queryCandidates<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function findVisible<T extends Element>(root: ParentNode, selectors: readonly string[]): T | null {
  for (const selector of selectors) {
    const match = queryCandidates<T>(root, selector).find((candidate) => isVisibleElement(candidate));
    if (match) {
      return match;
    }
  }
  return null;
}

export function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  return findVisible<HTMLElement | HTMLTextAreaElement>(document, COMPOSER_SELECTORS);
}

export function findComposerScope(): HTMLElement | null {
  const composer = findComposer();
  if (!composer) {
    return null;
  }

  const form = composer.closest("form");
  if (form instanceof HTMLElement) {
    return form;
  }

  const region = composer.closest('[data-testid*="composer"], [role="group"]');
  if (region instanceof HTMLElement) {
    return region;
  }

  return composer.parentElement;
}

function buttonDescriptor(button: HTMLButtonElement): string {
  return [
    button.getAttribute("aria-label"),
    button.getAttribute("data-testid"),
    button.getAttribute("title"),
    button.textContent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isLikelySendDescriptor(descriptor: string): boolean {
  const normalized = descriptor.toLowerCase();
  if (
    /stop|cancel|voice|microphone|record|attach|upload|add files|add photos|apps?|tools?|mode|menu|plus/.test(
      normalized
    )
  ) {
    return false;
  }

  return /send-button|send prompt|send message|(^|\s)send($|\s)/.test(normalized);
}

function submitButtonScore(button: HTMLButtonElement): number {
  const descriptor = buttonDescriptor(button);
  if (!isLikelySendDescriptor(descriptor)) {
    return -100;
  }

  let score = 0;
  if (descriptor.includes("send-button")) score += 120;
  if (/send prompt|send message/.test(descriptor)) score += 100;
  else if (/(^|\s)send($|\s)/.test(descriptor)) score += 80;
  if (button.closest("form")) score += 10;
  if (isVisibleElement(button)) score += 10;
  if (!button.disabled) score += 10;
  return score;
}

export function findSubmitButton(): HTMLButtonElement | null {
  const scope = findComposerScope() ?? document;

  for (const selector of SUBMIT_SELECTORS) {
    const button = queryCandidates<HTMLButtonElement>(scope, selector).find((candidate) => {
      return (
        isVisibleElement(candidate) &&
        !candidate.disabled &&
        isLikelySendDescriptor(buttonDescriptor(candidate))
      );
    });
    if (button) {
      return button;
    }
  }

  const ranked = queryCandidates<HTMLButtonElement>(scope, "button")
    .filter((candidate) => isVisibleElement(candidate) && !candidate.disabled)
    .map((button) => ({ button, score: submitButtonScore(button) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.button ?? null;
}

export function findAttachmentInput(): HTMLInputElement | null {
  const scope = findComposerScope() ?? document;

  for (const selector of ATTACHMENT_INPUT_SELECTORS) {
    const input = queryCandidates<HTMLInputElement>(scope, selector).find(
      (candidate) => !candidate.disabled
    );
    if (input) {
      return input;
    }
  }

  // Some versions of ChatGPT portal the hidden file input outside the composer form.
  for (const selector of ATTACHMENT_INPUT_SELECTORS) {
    const input = queryCandidates<HTMLInputElement>(document, selector).find(
      (candidate) => !candidate.disabled
    );
    if (input) {
      return input;
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

  return Array.from(document.querySelectorAll<HTMLElement>("main article")).filter((article) => {
    const text = article.innerText?.trim() ?? "";
    return text.length > 0;
  });
}

export function findLatestAssistantMessage(): HTMLElement | null {
  const messages = findAssistantMessages();
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

export function getAssistantMessageText(element: HTMLElement): string {
  return element.innerText?.trim() ?? "";
}

export function collectSelectorCandidateDiagnostics(): {
  composer: SelectorCandidateDiagnostic[];
  submit: SelectorCandidateDiagnostic[];
  attachment: SelectorCandidateDiagnostic[];
} {
  const scope = findComposerScope() ?? document;

  const collect = (root: ParentNode, selectors: readonly string[]) =>
    selectors.map((selector) => {
      const candidates = queryCandidates<Element>(root, selector);
      return {
        selector,
        count: candidates.length,
        visibleCount: candidates.filter((candidate) => isVisibleElement(candidate)).length
      };
    });

  return {
    composer: collect(document, COMPOSER_SELECTORS),
    submit: collect(scope, SUBMIT_SELECTORS),
    attachment: collect(scope, ATTACHMENT_INPUT_SELECTORS)
  };
}
