import type { Comment } from "@/types/feed";

export type CommentSortMode = "top" | "new" | "hot";

const timestamp = (value: string) => Date.parse(value) || 0;

function hotScore(comment: Comment, latestActivity: number, now: number): number {
  const total = comment.upvotes + comment.downvotes;
  if (!total) return 0;
  const z = 1.96;
  const proportion = comment.upvotes / total;
  const confidence = (proportion + z * z / (2 * total)
    - z * Math.sqrt((proportion * (1 - proportion) + z * z / (4 * total)) / total))
    / (1 + z * z / total);
  return confidence * Math.pow(0.5, Math.max(0, now - latestActivity) / 3_600_000 / 6);
}

/** Keep complete conversations together, with replies in reading order. */
export function buildCommentTree(comments: Comment[], sort: CommentSortMode = "new", now = Date.now()): Comment[] {
  const nodes = new Map(comments.map(comment => [comment.id, { ...comment, depth: 0, replies: [] as Comment[] }]));
  const roots: Comment[] = [];
  const activity = new Map<string, number>();

  for (const node of nodes.values()) {
    const parent = node.parentCommentId ? nodes.get(node.parentCommentId) : undefined;
    const ancestors = new Set([node.id]);
    let ancestor = parent;
    let cyclic = false;
    while (ancestor) {
      if (ancestors.has(ancestor.id)) { cyclic = true; break; }
      ancestors.add(ancestor.id);
      ancestor = ancestor.parentCommentId ? nodes.get(ancestor.parentCommentId) : undefined;
    }
    if (parent && !cyclic) parent.replies.push(node);
    else roots.push(node);
  }

  function prepare(node: Comment, depth: number): number {
    node.depth = depth;
    node.replies?.sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt) || a.id.localeCompare(b.id));
    const latest = Math.max(timestamp(node.createdAt), ...(node.replies ?? []).map(reply => prepare(reply, depth + 1)));
    activity.set(node.id, latest);
    return latest;
  }
  roots.forEach(root => prepare(root, 0));

  return roots.sort((a, b) => {
    const latestA = activity.get(a.id)!;
    const latestB = activity.get(b.id)!;
    const ranked = sort === "top"
      ? (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      : sort === "hot" ? hotScore(b, latestB, now) - hotScore(a, latestA, now) : 0;
    return ranked || latestB - latestA || timestamp(b.createdAt) - timestamp(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export function countCommentReplies(comment: Comment): number {
  return (comment.replies ?? []).reduce((total, reply) => total + 1 + countCommentReplies(reply), 0);
}
