export interface FeedMediaItem {
  mediaType?: "article" | "youtube";
  sourceUrl: string;
}

/**
 * Insert one YouTube card after every N article cards.
 * The caller controls pagination for both queues, so unused video candidates
 * remain available for later pages instead of being discarded.
 */
export function interleaveVideoCards<T extends FeedMediaItem>(
  rankedItems: T[],
  videoItems: T[],
  articleInterval = 4,
  limit = rankedItems.length + videoItems.length,
): T[] {
  const regularArticles = rankedItems.filter((item) => item.mediaType !== "youtube");
  const knownUrls = new Set(regularArticles.map((item) => item.sourceUrl));
  const videoUrls = new Set<string>();
  const videos = videoItems.filter((item) => {
    if (
      item.mediaType !== "youtube"
      || knownUrls.has(item.sourceUrl)
      || videoUrls.has(item.sourceUrl)
    ) return false;
    videoUrls.add(item.sourceUrl);
    return true;
  });
  const output: T[] = [];
  let articleIndex = 0;
  let videoIndex = 0;

  while (output.length < limit && articleIndex < regularArticles.length) {
    for (
      let slot = 0;
      slot < articleInterval
        && output.length < limit
        && articleIndex < regularArticles.length;
      slot += 1
    ) {
      output.push(regularArticles[articleIndex]);
      articleIndex += 1;
    }
    if (output.length < limit && videoIndex < videos.length) {
      output.push(videos[videoIndex]);
      videoIndex += 1;
    }
  }

  while (output.length < limit && videoIndex < videos.length) {
    output.push(videos[videoIndex]);
    videoIndex += 1;
  }

  return output;
}
