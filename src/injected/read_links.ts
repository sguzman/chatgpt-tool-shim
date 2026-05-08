export function readLinks(limit = 200) {
  const items = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((link) => ({
      text: link.textContent?.trim() ?? "",
      href: link.href
    }))
    .filter((item) => item.href)
    .slice(0, limit);

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href}|${item.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
