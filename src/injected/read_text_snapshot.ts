import { readLinks } from "./read_links";
import { readMetadata } from "./read_metadata";

export function readTextSnapshot(maxChars = 20000) {
  const text = document.body?.innerText?.replace(/\s+\n/g, "\n").trim() ?? "";
  const headings = Array.from(
    document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6")
  ).map((heading) => ({
    level: Number(heading.tagName.slice(1)),
    text: heading.textContent?.trim() ?? ""
  }));

  return {
    title: document.title,
    url: location.href,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    headings: headings.slice(0, 50),
    links: readLinks(100),
    meta: readMetadata().meta
  };
}
