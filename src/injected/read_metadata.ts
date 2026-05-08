export function readMetadata() {
  return {
    title: document.title,
    url: location.href,
    meta: Array.from(document.querySelectorAll<HTMLMetaElement>("meta[name],meta[property]")).reduce<
      Record<string, string>
    >((accumulator, element) => {
      const key = element.getAttribute("name") || element.getAttribute("property");
      const value = element.getAttribute("content");
      if (key && value) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {})
  };
}
