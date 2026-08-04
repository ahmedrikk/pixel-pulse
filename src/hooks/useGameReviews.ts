import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/contexts/AuthGateContext";

export type ReviewVoteDirection = "up" | "down";

export interface ReviewComment {
  id: string;
  reviewId: string;
  userId: string;
  parentCommentId: string | null;
  text: string;
  createdAt: string;
  author: { name: string; avatar: string | null };
}

export interface UserReview {
  id: string;
  userId: string;
  gameId: string;
  starRating: number;
  reviewText: string | null;
  tags: string[];
  upvoteCount: number;
  downvoteCount: number;
  userVote: ReviewVoteDirection | null;
  createdAt: string;
  author: { name: string; avatar: string | null };
  comments: ReviewComment[];
}

async function fetchUserReviews(gameId: string, currentUserId?: string): Promise<UserReview[]> {
  const { data, error } = await supabase
    .from("user_game_reviews")
    .select("id, user_id, game_id, star_rating, review_text, tags, helpful_votes, downvote_votes, created_at")
    .eq("game_id", gameId)
    .order("helpful_votes", { ascending: false })
    .limit(50);
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const reviewIds = rows.map((review) => review.id);

  const { data: commentRows, error: commentError } = reviewIds.length
    ? await supabase
        .from("game_review_comments")
        .select("id, review_id, user_id, parent_comment_id, text, created_at")
        .in("review_id", reviewIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (commentError) throw commentError;

  const { data: voteRows, error: voteError } = currentUserId && reviewIds.length
    ? await supabase
        .from("game_review_votes")
        .select("review_id, direction")
        .eq("user_id", currentUserId)
        .in("review_id", reviewIds)
    : { data: [], error: null };
  if (voteError) throw voteError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = (commentRows ?? []) as any[];
  const userIds = [...new Set([...rows.map((row) => row.user_id), ...comments.map((comment) => comment.user_id)])];
  const authors = new Map<string, { name: string; avatar: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      authors.set(profile.id, { name: profile.username ?? "Gamer", avatar: profile.avatar_url ?? null });
    }
  }

  const votes = new Map<string, ReviewVoteDirection>();
  for (const vote of voteRows ?? []) votes.set(vote.review_id, vote.direction as ReviewVoteDirection);

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    starRating: row.star_rating,
    reviewText: row.review_text,
    tags: row.tags ?? [],
    upvoteCount: Number(row.helpful_votes ?? 0),
    downvoteCount: Number(row.downvote_votes ?? 0),
    userVote: votes.get(row.id) ?? null,
    createdAt: row.created_at,
    author: authors.get(row.user_id) ?? { name: "Gamer", avatar: null },
    comments: comments
      .filter((comment) => comment.review_id === row.id)
      .map((comment) => ({
        id: comment.id,
        reviewId: comment.review_id,
        userId: comment.user_id,
        parentCommentId: comment.parent_comment_id,
        text: comment.text,
        createdAt: comment.created_at,
        author: authors.get(comment.user_id) ?? { name: "Gamer", avatar: null },
      })),
  }));
}

export function useUserReviews(gameId: string | undefined, currentUserId?: string) {
  return useQuery({
    queryKey: ["reviews", "user", gameId, currentUserId],
    queryFn: () => fetchUserReviews(gameId!, currentUserId),
    enabled: !!gameId,
  });
}

export interface MyReview {
  id: string;
  gameId: string;
  gameName: string;
  gameCover: string | null;
  starRating: number;
  reviewText: string | null;
  tags: string[];
  createdAt: string;
}

async function fetchMyReviews(userId: string): Promise<MyReview[]> {
  const { data, error } = await supabase
    .from("user_game_reviews")
    .select(`id, game_id, star_rating, review_text, tags, created_at, games ( name, cover_image )`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    gameId: row.game_id,
    gameName: row.games?.name ?? row.game_id,
    gameCover: row.games?.cover_image ?? null,
    starRating: row.star_rating,
    reviewText: row.review_text,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  }));
}

export function useMyReviews(userId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "mine", userId],
    queryFn: () => fetchMyReviews(userId!),
    enabled: !!userId,
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.from("user_game_reviews").delete().eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useSubmitReview(gameId: string, gameName?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuthGate();

  return useMutation({
    mutationFn: async (payload: { starRating: number; reviewText: string; tags: string[] }) => {
      if (!user) throw new Error("Not authenticated");

      await supabase.from("games").upsert(
        {
          id: gameId,
          name: gameName ?? gameId,
          slug: gameId,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        { onConflict: "id" },
      );

      const { error } = await supabase.from("user_game_reviews").upsert({
        user_id: user.id,
        game_id: gameId,
        star_rating: payload.starRating,
        review_text: payload.reviewText || null,
        tags: payload.tags,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,game_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useVoteReview(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, direction }: { reviewId: string; direction: ReviewVoteDirection }) => {
      const { error } = await supabase.rpc("toggle_game_review_vote", {
        p_review_id: reviewId,
        p_direction: direction,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] }),
  });
}

export function useAddReviewComment(gameId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuthGate();
  return useMutation({
    mutationFn: async ({ reviewId, text, parentCommentId }: { reviewId: string; text: string; parentCommentId?: string | null }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("game_review_comments").insert({
        review_id: reviewId,
        user_id: user.id,
        parent_comment_id: parentCommentId ?? null,
        text: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] }),
  });
}
