import { describe, expect, it } from "vitest";
import { buildCommentTree, countCommentReplies } from "./commentTree";
import { makeComment } from "@/test/commentFixtures";

describe("comment conversations", () => {
  it("brings an older conversation to the top when it receives the newest reply", () => {
    const old = makeComment("old", { createdAt: "2026-11-09T18:00:00Z" });
    const newer = makeComment("newer", { createdAt: "2026-11-09T20:00:00Z" });
    const reply = makeComment("reply", { parentCommentId: "old", createdAt: "2026-11-09T21:00:00Z" });
    expect(buildCommentTree([newer, reply, old]).map(c => c.id)).toEqual(["old", "newer"]);
  });

  it("keeps replies in reading order and assigns their actual nesting depth", () => {
    const rows = [makeComment("root"),
      makeComment("later", { parentCommentId: "root", createdAt: "2026-11-09T21:00:00Z" }),
      makeComment("first", { parentCommentId: "root", createdAt: "2026-11-09T20:01:00Z", depth: 1 }),
      makeComment("nested", { parentCommentId: "first", depth: 1 }),
      makeComment("deep", { parentCommentId: "nested", depth: 1 })];
    const [root] = buildCommentTree(rows);
    expect(root.replies?.map(c => c.id)).toEqual(["first", "later"]);
    expect(root.replies?.[0].replies?.[0].depth).toBe(2);
    expect(root.replies?.[0].replies?.[0].replies?.[0].depth).toBe(3);
    expect(countCommentReplies(root)).toBe(4);
    expect(rows[3].depth).toBe(1);
    expect(rows[0].replies).toBeUndefined();
  });

  it("retains orphaned comments and breaks malformed cycles instead of losing messages", () => {
    const tree = buildCommentTree([
      makeComment("orphan", { parentCommentId: "missing" }),
      makeComment("a", { parentCommentId: "b" }),
      makeComment("b", { parentCommentId: "a" }),
    ]);
    expect(tree.map(c => c.id).sort()).toEqual(["a", "b", "orphan"]);
    expect(tree.every(c => c.depth === 0 && !c.replies?.length)).toBe(true);
  });

  it("preserves top sorting by votes and hot sorting by confidence and activity", () => {
    const popular = makeComment("popular", { upvotes: 20, createdAt: "2026-11-01T00:00:00Z" });
    const active = makeComment("active", { upvotes: 4, createdAt: "2026-11-09T20:00:00Z" });
    expect(buildCommentTree([active, popular], "top")[0].id).toBe("popular");
    expect(buildCommentTree([active, popular], "hot", Date.parse("2026-11-09T21:00:00Z"))[0].id).toBe("active");
  });
});
