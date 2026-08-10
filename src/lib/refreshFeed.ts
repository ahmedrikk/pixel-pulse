export const REFRESH_FEED_EVENT = "talus:refresh-feed";

export function requestHomeFeedRefresh() {
  window.dispatchEvent(new CustomEvent(REFRESH_FEED_EVENT));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
