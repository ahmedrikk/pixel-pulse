import { useEffect, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import {
  Crown,
  BellRing,
  ExternalLink,
  Gamepad2,
  Gift,
  MessageCircle,
  Monitor,
  ScrollText,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShareReviewButton } from "@/components/ShareReviewButton";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useGameDetails } from "@/hooks/useGameDetails";
import { patchPath, useRecentGamePatches } from "@/hooks/useGamePatches";
import {
  useAddReviewComment,
  useSubmitReview,
  useUserReviews,
  useVoteReview,
  type ReviewVoteDirection,
  type UserReview,
} from "@/hooks/useGameReviews";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const platformIcons: Record<string, React.ReactNode> = {
  PC: <Monitor className="h-4 w-4" />,
  PS5: <Gamepad2 className="h-4 w-4" />,
  PS4: <Gamepad2 className="h-4 w-4" />,
  Xbox: <Gamepad2 className="h-4 w-4" />,
  Switch: <Gamepad2 className="h-4 w-4" />,
};

function StarRating({
  rating,
  interactive = false,
  onChange,
}: {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <button
          key={index}
          type="button"
          disabled={!interactive}
          aria-label={interactive ? `${index + 1} stars` : undefined}
          onClick={() => interactive && onChange?.(index + 1)}
          className={cn("disabled:cursor-default", interactive && "transition-transform hover:scale-110")}
        >
          <Star className={cn("h-5 w-5", index < rating ? "fill-primary text-primary" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  gameName,
  coverUrl,
  currentUserId,
  onVote,
  onComment,
}: {
  review: UserReview;
  gameName: string;
  coverUrl: string;
  currentUserId?: string;
  onVote: (reviewId: string, direction: ReviewVoteDirection) => void;
  onComment: (reviewId: string, text: string) => Promise<boolean>;
}) {
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(review.comments.length > 0);
  const [submitting, setSubmitting] = useState(false);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    const posted = await onComment(review.id, commentText.trim());
    setSubmitting(false);
    if (posted) {
      setCommentText("");
      setShowComments(true);
    }
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-card p-4 card-shadow sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {review.author.avatar ? (
            <img src={review.author.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground">
              {review.author.name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{review.author.name}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "MMM d, yyyy")}</p>
          </div>
        </div>
        <StarRating rating={review.starRating} />
      </div>

      {review.reviewText && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{review.reviewText}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <button
          type="button"
          aria-label={`Upvote review by ${review.author.name}`}
          onClick={() => onVote(review.id, "up")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            review.userVote === "up" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          {review.upvoteCount}
        </button>
        <button
          type="button"
          aria-label={`Downvote review by ${review.author.name}`}
          onClick={() => onVote(review.id, "down")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            review.userVote === "down" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <ThumbsDown className="h-4 w-4" />
          {review.downvoteCount}
        </button>
        <button
          type="button"
          aria-label={`${showComments ? "Hide" : "Show"} comments on ${review.author.name}'s review`}
          onClick={() => setShowComments((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {review.comments.length}
        </button>
        {review.userId === currentUserId && (
          <div className="ml-auto">
            <ShareReviewButton
              gameId={review.gameId}
              gameName={gameName}
              starRating={review.starRating}
              reviewText={review.reviewText}
              coverUrl={coverUrl}
              userName={review.author.name}
            />
          </div>
        )}
      </div>

      {showComments && (
        <div className="mt-4 space-y-3 border-l-2 border-primary/15 pl-3 sm:pl-4">
          {review.comments.map((comment) => (
            <div key={comment.id} className="rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground">{comment.author.name}</span>
                <time className="text-muted-foreground">{format(new Date(comment.createdAt), "MMM d")}</time>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{comment.text}</p>
            </div>
          ))}
          {review.comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Start the discussion.</p>}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && submitComment()}
              placeholder="Reply to this review…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border-0 bg-secondary px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={!commentText.trim() || submitting}
              className="rounded-xl bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </motion.article>
  );
}

export default function GameReview() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, openAuthModal, pendingAction, executePendingAction } = useAuthGate();
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [sortBy, setSortBy] = useState<"helpful" | "recent">("helpful");
  const [following, setFollowing] = useState(false);

  const gameQuery = useGameDetails(gameId);
  const reviewsQuery = useUserReviews(gameId, user?.id);
  const patchesQuery = useRecentGamePatches(gameId);
  const submitReview = useSubmitReview(gameId ?? "", gameQuery.data?.name);
  const voteReview = useVoteReview(gameId ?? "");
  const addComment = useAddReviewComment(gameId ?? "");

  useEffect(() => {
    if (!user || !pendingAction || pendingAction.type !== "review" || pendingAction.gameId !== gameId) return;
    const draft = pendingAction.data as { starRating?: number; reviewText?: string } | undefined;
    if (draft?.starRating) setNewRating(draft.starRating);
    if (draft?.reviewText) setNewReviewText(draft.reviewText);
    executePendingAction();
    toast.success("Your review draft is ready to submit.");
  }, [user, pendingAction, gameId, executePendingAction]);

  useEffect(() => {
    if (!user || !gameId) { setFollowing(false); return; }
    supabase.from("game_follows").select("game_id").eq("user_id", user.id).eq("game_id", gameId).maybeSingle().then(({ data }) => setFollowing(!!data));
  }, [gameId, user]);

  if (gameQuery.isLoading) {
    return <SiteLayout><div className="h-[520px] animate-pulse rounded-2xl bg-secondary" /></SiteLayout>;
  }
  if (gameQuery.error || !gameQuery.data) return <Navigate to="/reviews" replace />;

  const game = gameQuery.data;
  async function toggleFollow() {
    if (!user) return openAuthModal("react");
    const request = following
      ? supabase.from("game_follows").delete().eq("user_id", user.id).eq("game_id", game.id)
      : supabase.from("game_follows").insert({ user_id: user.id, game_id: game.id });
    const { error } = await request;
    if (error) toast.error("Couldn’t update game notifications.");
    else { setFollowing(!following); toast.success(following ? "Patch notifications turned off." : `You’ll be notified about ${game.name} patches.`); }
  }
  const reviews = reviewsQuery.data ?? [];
  const myRating = reviews.find((review) => review.userId === user?.id)?.starRating ?? null;
  const sortedReviews = [...reviews].sort((a, b) => sortBy === "recent"
    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    : (b.upvoteCount - b.downvoteCount) - (a.upvoteCount - a.downvoteCount));

  const handleVote = (reviewId: string, direction: ReviewVoteDirection) => {
    if (!user) return openAuthModal("react");
    voteReview.mutate({ reviewId, direction }, { onError: () => toast.error("Couldn't register your vote.") });
  };

  const handleComment = async (reviewId: string, text: string) => {
    if (!user) {
      openAuthModal("comment");
      return false;
    }
    try {
      await addComment.mutateAsync({ reviewId, text });
      return true;
    } catch {
      toast.error("Couldn't post that comment.");
      return false;
    }
  };

  const handleSubmitReview = async () => {
    if (!newReviewText.trim() || newRating === 0) return;
    if (!user) {
      openAuthModal("review", { gameId: game.id, data: { starRating: newRating, reviewText: newReviewText.trim() } });
      return;
    }
    try {
      await submitReview.mutateAsync({ starRating: newRating, reviewText: newReviewText.trim(), tags: [] });
      setNewReviewText("");
      setNewRating(0);
      toast.success(myRating ? "Review updated." : "Review posted.");
    } catch {
      toast.error("Couldn't save your review.");
    }
  };

  return (
    <>
      <SiteLayout>
        <main className="space-y-7 pb-16 md:pb-0">
          <header className="relative min-h-[380px] overflow-hidden rounded-2xl border bg-card sm:min-h-[460px]">
            {game.coverImage && <img src={game.coverImage} alt={game.name} className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/10" />
            <div className="relative flex min-h-[380px] flex-col justify-end p-5 sm:min-h-[460px] sm:p-8">
              <div className="mb-3 flex flex-wrap gap-2">
                {game.genres.slice(0, 4).map((genre) => <span key={genre} className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold capitalize text-primary backdrop-blur-sm">{genre.replace(/-/g, " ")}</span>)}
              </div>
              <h1 className="text-3xl font-black leading-tight text-foreground sm:text-5xl">{game.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {[game.developer, game.releaseDate].filter(Boolean).join(" · ")}
              </p>
              <Button variant={following ? "secondary" : "outline"} size="sm" onClick={toggleFollow} className="mt-3 w-fit gap-2 bg-card/90 backdrop-blur-sm"><BellRing className="h-4 w-4" />{following ? "Following Patches" : "Follow Game Updates"}</Button>

              <div className="mt-5 flex flex-wrap items-stretch gap-2">
                <div className="rounded-xl border bg-card/90 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex items-baseline gap-1"><span className="text-2xl font-black text-primary">{game.reviewCount ? game.ourRating.toFixed(1) : "—"}</span><span className="text-xs text-muted-foreground">/5</span></div>
                  <p className="text-tiny-label text-muted-foreground">Talus · {game.reviewCount} reviews</p>
                </div>
                {game.externalRatings.map((rating) => (
                  <div key={rating.source} className="rounded-xl border bg-card/90 px-4 py-2.5 backdrop-blur-sm">
                    <div className="text-2xl font-black text-foreground">{rating.score}<span className="text-xs font-medium text-muted-foreground">/{rating.scale}</span></div>
                    <p className="text-tiny-label text-muted-foreground">{rating.source}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {game.platforms.map((platform) => (
                  <span key={platform} className="inline-flex items-center gap-1.5 rounded-lg border bg-card/85 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                    {platformIcons[platform] ?? <Gamepad2 className="h-4 w-4" />}{platform}
                  </span>
                ))}
              </div>
            </div>
          </header>

          {game.freeNow && game.freeOfferUrl && (
            <section className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"><Gift className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-bold text-foreground">Free to claim now</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {game.freeOfferStore ?? "Store offer"}{game.freeOfferEndsAt ? ` · Ends in ${formatDistanceToNowStrict(new Date(game.freeOfferEndsAt))}` : ""}
                  </p>
                </div>
              </div>
              <a href={game.freeOfferUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                Claim free <ExternalLink className="h-4 w-4" />
              </a>
            </section>
          )}

          <section className="rounded-2xl border bg-card p-5 card-shadow sm:p-7">
            <h2 className="text-xl font-bold text-foreground">About the game</h2>
            {game.description ? (
              <div className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">{game.description}</div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No information available right now.</p>
            )}
          </section>

          {(patchesQuery.isLoading || (patchesQuery.data?.length ?? 0) > 0) && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><ScrollText className="h-5 w-5 text-primary" />Recent patches</h2>
                <Link to={`/game-patch/${game.id}`} className="text-sm font-semibold text-primary hover:underline">All patches →</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {patchesQuery.isLoading ? Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-secondary" />) : patchesQuery.data?.map((patch) => (
                  <Link key={patch.id} to={patchPath(patch)} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
                    <div className="flex items-center justify-between gap-3 text-tiny-label text-muted-foreground"><span className="font-bold uppercase text-primary">{patch.patchType}</span><time>{format(new Date(patch.publishedAt), "MMM d, yyyy")}</time></div>
                    <h3 className="mt-2 line-clamp-2 font-bold text-foreground">{patch.title}</h3>
                    {patch.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{patch.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-5">
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Crown className="h-5 w-5 text-primary" />Community reviews</h2>

            <div className="rounded-2xl border bg-card p-5 card-shadow sm:p-6">
              <h3 className="font-semibold text-foreground">{myRating ? "Update your review" : "Write a review"}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">Your rating</span>
                <StarRating rating={newRating} interactive onChange={setNewRating} />
                {newRating > 0 && <span className="text-sm font-bold text-primary">{newRating}/5</span>}
              </div>
              <textarea
                value={newReviewText}
                onChange={(event) => setNewReviewText(event.target.value)}
                placeholder="What worked, what didn't, and who would you recommend it to?"
                maxLength={5000}
                className="mt-4 min-h-28 w-full resize-y rounded-xl border-0 bg-secondary p-4 text-sm text-foreground outline-none ring-primary focus:ring-2"
              />
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={handleSubmitReview} disabled={!newReviewText.trim() || !newRating || submitReview.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  <Send className="h-4 w-4" />{submitReview.isPending ? "Saving…" : myRating ? "Update review" : "Post review"}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setSortBy("helpful")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", sortBy === "helpful" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>Most upvoted</button>
              <button type="button" onClick={() => setSortBy("recent")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", sortBy === "recent" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>Most recent</button>
            </div>

            {reviewsQuery.isLoading ? (
              <div className="h-48 animate-pulse rounded-2xl bg-secondary" />
            ) : sortedReviews.length ? (
              <div className="space-y-4">
                {sortedReviews.map((review) => <ReviewCard key={review.id} review={review} gameName={game.name} coverUrl={game.coverImage} currentUserId={user?.id} onVote={handleVote} onComment={handleComment} />)}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No community reviews yet. Be the first.</div>
            )}
          </section>
        </main>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
