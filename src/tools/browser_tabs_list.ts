export async function browserTabsList(args: { currentWindowOnly: boolean }) {
  const tabs = await chrome.tabs.query(args.currentWindowOnly ? { currentWindow: true } : {});
  return {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      windowId: tab.windowId,
      active: tab.active,
      title: tab.title ?? "",
      url: tab.url ?? ""
    }))
  };
}
