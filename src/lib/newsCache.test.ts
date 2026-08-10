import { describe, expect, it, vi } from "vitest";
import type { NewsItem } from "@/data/mockNews";
import { spotifyShuffle } from "./newsCache";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

function article(id: string, source: string): NewsItem {
  return {
    id,
    title: id,
    summary: id,
    sourceUrl: `https://example.com/${id}`,
    imageUrl: "",
    category: "Gaming",
    timestamp: "2026-08-10T00:00:00.000Z",
    source,
    author: "Talus",
    tags: [],
  };
}

describe("spotifyShuffle", () => {
  it("always changes the lead story when another article is available", () => {
    const original = [article("one", "A"), article("two", "B"), article("three", "C")];

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(spotifyShuffle(original)[0].id).not.toBe("one");
    }
  });

  it("does not mutate the original feed", () => {
    const original = [article("one", "A"), article("two", "B")];
    spotifyShuffle(original);
    expect(original.map((item) => item.id)).toEqual(["one", "two"]);
  });
});
