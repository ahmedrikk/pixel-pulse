import { describe, expect, it } from "vitest";
import { interleaveVideoCards, type FeedMediaItem } from "./feedCadence";

function item(id: string, mediaType: FeedMediaItem["mediaType"] = "article"): FeedMediaItem {
  return { sourceUrl: id, mediaType };
}

describe("interleaveVideoCards", () => {
  it("places one video after every four article cards", () => {
    const articles = Array.from({ length: 8 }, (_, index) => item(`a${index + 1}`));
    const videos = [item("v1", "youtube"), item("v2", "youtube")];

    expect(interleaveVideoCards(articles, videos, 4, 10).map((entry) => entry.sourceUrl))
      .toEqual(["a1", "a2", "a3", "a4", "v1", "a5", "a6", "a7", "a8", "v2"]);
  });

  it("never duplicates a video already present in the ranked input", () => {
    const ranked = [item("a1"), item("v1", "youtube"), item("a2")];
    const videos = [item("v1", "youtube"), item("v2", "youtube")];

    const result = interleaveVideoCards(ranked, videos, 2, 3);
    expect(result.map((entry) => entry.sourceUrl)).toEqual(["a1", "a2", "v1"]);
  });

  it("fills the page with articles when fewer videos are available", () => {
    const articles = Array.from({ length: 10 }, (_, index) => item(`a${index + 1}`));
    const videos = [item("v1", "youtube")];

    expect(interleaveVideoCards(articles, videos, 4, 10)).toHaveLength(10);
  });
});
