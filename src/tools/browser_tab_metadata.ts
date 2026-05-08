export async function browserTabMetadata(args: { tabId: number }) {
  const tab = await chrome.tabs.get(args.tabId);
  return {
    title: tab.title ?? "",
    url: tab.url ?? "",
    favIconUrl: tab.favIconUrl ?? "",
    status: tab.status ?? "unknown"
  };
}
