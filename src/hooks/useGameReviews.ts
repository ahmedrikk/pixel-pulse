// src/hooks/useGameReviews.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/contexts/AuthGateContext";

export interface UserReview {
  id: string;
  userId: string;
  gameId: string;
  starRating: number;
  reviewText: string | null;
  tags: string[];
  helpfulVotes: number;
  createdAt: string;
  author: {
    name: string;
    avatar: string | null;
  };
}

async function fetchUserReviews(gameId: string): Promise<UserReview[]> {
  const { data, error } = await supabase
    .from("user_game_reviews")
    .select(`
      id, user_id, game_id, star_rating, review_text,
      tags, helpful_votes, created_at,
      profiles ( username, avatar_url )
    `)
    .eq("game_id", gameId)
    .order("helpful_votes", { ascending: false })
    .limit(20);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    gameId: r.game_id,
    starRating: r.star_rating,
    reviewText: r.review_text,
    tags: r.tags ?? [],
    helpfulVotes: r.helpful_votes,
    createdAt: r.created_at,
    author: {
      name: r.profiles?.username ?? "Anonymous",
      avatar: r.profiles?.avatar_url ?? null,
    },
  }));
}

export function useUserReviews(gameId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "user", gameId],
    queryFn: () => fetchUserReviews(gameId!),
    enabled: !!gameId,
  });
}

// ── A single user's own reviews (across all games), for their profile ────────
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
    .select(`
      id, game_id, star_rating, review_text, tags, created_at,
      games ( name, cover_image )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    gameId: r.game_id,
    gameName: r.games?.name ?? r.game_id,
    gameCover: r.games?.cover_image ?? null,
    starRating: r.star_rating,
    reviewText: r.review_text,
    tags: r.tags ?? [],
    createdAt: r.created_at,
  }));
}

export function useMyReviews(userId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "mine", userId],
    queryFn: () => fetchMyReviews(userId!),
    enabled: !!userId,
  });
}

export function useSubmitReview(gameId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuthGate();

  return useMutation({
    mutationFn: async (payload: {
      starRating: number;
      reviewText: string;
      tags: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Ensure game exists in cache before inserting review
      await supabase.from("games").upsert(
        { id: gameId, name: gameId, slug: gameId, expires_at: new Date(Date.now() + 86400000).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );

      const { error } = await supabase.from("user_game_reviews").insert({
        user_id: user.id,
        game_id: gameId,
        star_rating: payload.starRating,
        review_text: payload.reviewText || null,
        tags: payload.tags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] });
    },
  });
}

export function useVoteHelpful(gameId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.rpc("increment_helpful_votes", {
        review_id: reviewId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] });
    },
  });
}
