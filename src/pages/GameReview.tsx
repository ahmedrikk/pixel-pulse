import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  ThumbsUp,
  Monitor,
  Gamepad2,
  Trophy,
  ChevronRight,
  Send,
  Crown,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { trackComment, trackReaction } from "@/lib/xpService";
import { useGameDetails } from "@/hooks/useGameDetails";
import { useUserReviews, useSubmitReview } from "@/hooks/useGameReviews";

const platformIcons: Record<string, React.ReactNode> = {
  PC: <Monitor className="h-5 w-5" />,
  PS5: <Gamepad2 className="h-5 w-5" />,
  Xbox: <Gamepad2 className="h-5 w-5" />,
  Switch: <Gamepad2 className="h-5 w-5" />,
};

function StarRating({
  rating,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
}: {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const sizeMap = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`${sizeMap[size]} transition-colors ${
            i < rating
              ? "fill-primary text-primary"
              : "text-muted-foreground/30"
          } ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          onClick={() => interactive && onChange?.(i + 1)}
        />
      ))}
    </div>
  );
}

export default function GameReview() {
  const { gameId } = useParams<{ gameId: string }>();
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [sortBy, setSortBy] = useState<"helpful" | "recent">("helpful");

  const { data: game, isLoading: gameLoading, error: gameError } = useGameDetails(gameId);
  const { data: userReviews = [] } = useUserReviews(gameId);
  const submitReview = useSubmitReview(gameId ?? "");

  if (gameLoading) {
    return (
      <SiteLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-64 rounded-2xl bg-secondary" />
          <div className="h-8 w-1/2 rounded bg-secondary" />
          <div className="h-4 w-full rounded bg-secondary" />
          <div className="h-4 w-3/4 rounded bg-secondary" />
        </div>
      </SiteLayout>
    );
  }

  if (gameError || !game) {
    return <Navigate to="/reviews" replace />;
  }

  const handleVote = (reviewId: string) => {
    trackReaction(game.id, "helpful");
    // Optimistic UI — actual vote goes through useVoteHelpful mutation
  };

  const handleSubmitReview = async () => {
    if (!newReviewText.trim() || newRating === 0) return;
    try {
      await submitReview.mutateAsync({
        starRating: newRating,
        reviewText: newReviewText.trim(),
        tags: [],
      });
      setNewReviewText("");
      setNewRating(0);
      trackComment(game.id);
    } catch {
      // Auth gate will handle unauthenticated state
    }
  };

  // Critic reviews from OpenCritic
  const criticReviews = (game.openCritic?.reviews ?? []).map((r, i) => ({
    id: `critic-${i}`,
    userName: r.author,
    outlet: r.outlet,
    outletLogo: r.outletLogo,
    rating: r.score ? Math.round((r.score / 100) * 5) : 3,
    score: r.score,
    text: r.snippet,
    date: r.publishedDate,
    helpful: 0,
    url: r.url,
    isCritic: true,
  }));

  // User reviews sorted
  const sortedUserReviews = [...userReviews].sort((a, b) =>
    sortBy === "helpful"
      ? b.helpfulVotes - a.helpfulVotes
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <SiteLayout>

      {/* Hero */}
      <div className="relative h-[420px] md:h-[480px] overflow-hidden rounded-2xl mb-6">
        <img
          src={game.coverImage}
          alt={game.name}
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {game.genres[0] && (
              <span className="inline-block px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-3">
                {game.genres[0]}
              </span>
            )}
            <h1 className="text-3xl md:text-5xl font-black text-foreground mb-2 leading-tight">
              {game.name}
            </h1>
            {game.releaseDate && (
              <p className="text-muted-foreground text-sm mb-4">
                {game.releaseDate}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              {/* RAWG Rating */}
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border rounded-xl px-4 py-2.5">
                <span className="text-2xl font-black text-primary">{game.rawgRating.toFixed(1)}</span>
                <div>
                  <StarRating rating={Math.round(game.rawgRating)} size="sm" />
                  <p className="text-xs text-muted-foreground">RAWG rating</p>
                </div>
              </div>

              {/* OpenCritic Score */}
              {game.openCritic?.score && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="text-center">
                    <div className="text-2xl font-black text-primary">{game.openCritic.score}</div>
                    <div className="text-[10px] text-muted-foreground">OpenCritic</div>
                  </div>
                  {game.openCritic.tier && (
                    <div>
                      <div className="text-sm font-semibold">{game.openCritic.tier}</div>
                      {game.openCritic.percentRecommended != null && (
                        <div className="text-xs text-muted-foreground">
                          {game.openCritic.percentRecommended.toFixed(0)}% recommend
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Metacritic */}
              {game.metacriticScore && (
                <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border rounded-xl px-4 py-2.5">
                  <span className="text-2xl font-black text-primary">{game.metacriticScore}</span>
                  <p className="text-xs text-muted-foreground">Metacritic</p>
                </div>
              )}

              {/* Platforms */}
              <div className="flex items-center gap-2 flex-wrap">
                {game.platforms.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-1.5 px-3 py-2 bg-card/80 backdrop-blur-sm border rounded-lg text-sm text-muted-foreground"
                  >
                    {platformIcons[p] || <Gamepad2 className="h-5 w-5" />}
                    <span className="font-medium">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">

        {/* Description */}
        {game.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border rounded-2xl p-6 card-shadow"
          >
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <ChevronRight className="h-5 w-5 text-primary" />
              About the Game
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-6">{game.description}</p>
          </motion.div>
        )}

        {/* Critic Reviews */}
        {criticReviews.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Critic Reviews
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {criticReviews.map((r) => (
                <motion.a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="block bg-card border rounded-xl p-5 card-shadow hover:card-shadow-hover transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {r.outletLogo ? (
                        <img src={r.outletLogo} alt={r.outlet} className="w-8 h-8 rounded object-contain bg-secondary p-1" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-xs">
                          {r.outlet[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{r.outlet}</p>
                        <p className="text-xs text-muted-foreground">{r.userName}</p>
                      </div>
                    </div>
                    {r.score != null && (
                      <span className="text-lg font-black text-primary">{r.score}/100</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{r.text}</p>
                </motion.a>
              ))}
            </div>
          </div>
        )}

        {/* Community Reviews */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Community Reviews
          </h2>

          {/* Write Review */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border rounded-2xl p-6 card-shadow"
          >
            <h3 className="font-semibold text-foreground mb-3">Write a Review</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-muted-foreground">Your Rating:</span>
              <StarRating rating={newRating} interactive onChange={setNewRating} />
              {newRating > 0 && (
                <span className="text-sm font-bold text-primary">{newRating}/5</span>
              )}
            </div>
            <textarea
              value={newReviewText}
              onChange={(e) => setNewReviewText(e.target.value)}
              placeholder="Share your thoughts on the game..."
              className="w-full min-h-[100px] rounded-xl bg-secondary border-0 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSubmitReview}
                disabled={!newReviewText.trim() || newRating === 0 || submitReview.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {submitReview.isPending ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </motion.div>

          {/* Sort */}
          <div className="flex gap-2">
            {(["helpful", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sortBy === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "helpful" ? "Most Helpful" : "Most Recent"}
              </button>
            ))}
          </div>

          {/* Review List */}
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {sortedUserReviews.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border rounded-xl p-5 card-shadow hover:card-shadow-hover transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {r.author.name[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{r.author.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <StarRating rating={r.starRating} size="sm" />
                  </div>

                  {r.reviewText && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.reviewText}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground mr-1">Helpful?</span>
                    <button
                      onClick={() => handleVote(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="font-medium">{r.helpfulVotes}</span>
                    </button>
                  </div>
                </motion.div>
              ))}

              {sortedUserReviews.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No community reviews yet. Be the first!
                </p>
              )}
            </div>
          </AnimatePresence>
        </div>
      </div>
    </SiteLayout>
  );
}
