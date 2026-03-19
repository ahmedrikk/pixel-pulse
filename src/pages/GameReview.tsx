import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Monitor,
  Gamepad2,
  Play,
  Trophy,
  ChevronRight,
  Send,
  Crown,
} from "lucide-react";
import { FEATURED_GAME, TOP_REVIEWERS, type GameReview as ReviewType } from "@/data/gameReviewData";
import { Navbar } from "@/components/Navbar";

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

function ScoreBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-primary">{score}/{max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  onVote,
}: {
  review: ReviewType;
  onVote: (id: string, type: "up" | "down") => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-xl p-5 card-shadow hover:card-shadow-hover transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm">
            {review.avatar}
          </div>
          <div>
            <p className="font-semibold text-foreground">{review.userName}</p>
            <p className="text-xs text-muted-foreground">
              {review.reviewCount} reviews • {new Date(review.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{review.text}</p>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground mr-1">Helpful?</span>
        <button
          onClick={() => onVote(review.id, "up")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span className="font-medium">{review.helpful}</span>
        </button>
        <button
          onClick={() => onVote(review.id, "down")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span className="font-medium">{review.notHelpful}</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function GameReview() {
  const game = FEATURED_GAME;
  const [reviews, setReviews] = useState(game.reviews);
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [sortBy, setSortBy] = useState<"helpful" | "recent">("helpful");

  const sortedReviews = [...reviews].sort((a, b) =>
    sortBy === "helpful" ? b.helpful - a.helpful : new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleVote = (id: string, type: "up" | "down") => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [type === "up" ? "helpful" : "notHelpful"]: r[type === "up" ? "helpful" : "notHelpful"] + 1 }
          : r
      )
    );
  };

  const handleSubmitReview = () => {
    if (!newReviewText.trim() || newRating === 0) return;
    const review: ReviewType = {
      id: `r${Date.now()}`,
      userName: "GamerTag_X",
      avatar: "GT",
      rating: newRating,
      text: newReviewText,
      date: new Date().toISOString().split("T")[0],
      helpful: 0,
      notHelpful: 0,
      reviewCount: 1,
    };
    setReviews((prev) => [review, ...prev]);
    setNewReviewText("");
    setNewRating(0);
  };

  const overallScore = Object.values(game.scores).reduce((a, b) => a + b, 0) / Object.values(game.scores).length;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />

      {/* Hero */}
      <div className="relative h-[420px] md:h-[480px] overflow-hidden">
        <img
          src={game.heroImage}
          alt={game.name}
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-3">
              {game.genre}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-foreground mb-2 leading-tight">
              {game.name}
            </h1>
            <p className="text-muted-foreground text-sm mb-4">
              {game.developer} • {game.releaseDate}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {/* Rating */}
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border rounded-xl px-4 py-2.5">
                <span className="text-2xl font-black text-primary">{game.averageRating}</span>
                <div>
                  <StarRating rating={Math.round(game.averageRating)} size="sm" />
                  <p className="text-xs text-muted-foreground">{game.totalRatings.toLocaleString()} ratings</p>
                </div>
              </div>

              {/* Platforms */}
              <div className="flex items-center gap-2">
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Bento Grid: Trailer + Verdict + Description */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trailer */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border rounded-2xl overflow-hidden card-shadow"
          >
            <div className="aspect-video bg-secondary flex items-center justify-center relative group cursor-pointer">
              <iframe
                src={game.trailerUrl}
                title="Game Trailer"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>

          {/* Quick Verdict */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border rounded-2xl p-6 card-shadow flex flex-col"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-primary to-accent" />
              <h2 className="text-xl font-bold text-foreground">Quick Verdict</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1">
              {game.quickVerdict}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Play className="h-4 w-4 text-primary" />
              <span className="font-medium">TL;DR — A masterpiece expansion that raises the bar.</span>
            </div>
          </motion.div>
        </div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border rounded-2xl p-6 card-shadow"
        >
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <ChevronRight className="h-5 w-5 text-primary" />
            About the Game
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{game.description}</p>
        </motion.div>

        {/* Bento Grid: Scores + Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Score Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-card border rounded-2xl p-6 card-shadow"
          >
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Score Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {Object.entries(game.scores).map(([key, val]) => (
                <ScoreBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} score={val} />
              ))}
            </div>
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Overall Score</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-primary">{overallScore.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">/ 5</span>
              </div>
            </div>
          </motion.div>

          {/* Top Reviewers Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card border rounded-2xl p-6 card-shadow"
          >
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Top Reviewers
            </h2>
            <div className="space-y-3">
              {TOP_REVIEWERS.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className={`text-xs font-black w-5 text-center ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground font-bold text-xs">
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.reviews} reviews</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{r.helpful.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* User Reviews Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Community Reviews</h2>

          {/* Write Review */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
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
                disabled={!newReviewText.trim() || newRating === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                Submit Review
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
              {sortedReviews.map((r) => (
                <ReviewCard key={r.id} review={r} onVote={handleVote} />
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>
      <BottomNavBar />
    </div>
  );
}
