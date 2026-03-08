import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Star, Heart, Monitor, Gamepad2, Clock, Trophy, Users, UserPlus, ChevronRight, Sparkles, Shield } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { MobileMenu } from "@/components/MobileMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MOCK_PROFILE } from "@/data/profileData";

const platformIcon = (p: string) => {
  switch (p) {
    case "PC": return <Monitor className="h-4 w-4" />;
    default: return <Gamepad2 className="h-4 w-4" />;
  }
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function UserProfile() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 400], [0, 120]);
  const bannerScale = useTransform(scrollY, [0, 400], [1, 1.15]);
  const profile = MOCK_PROFILE;

  return (
    <div className="min-h-screen bg-background">
      <Navbar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isMobileMenuOpen={isMobileMenuOpen} />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Banner with Parallax */}
      <div ref={bannerRef} className="relative h-56 sm:h-72 md:h-80 overflow-hidden">
        <motion.div style={{ y: bannerY, scale: bannerScale }} className="absolute inset-0">
          <img
            src={profile.bannerImage}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </motion.div>
      </div>

      {/* Profile Card - Glassmorphism overlay */}
      <div className="container relative -mt-24 sm:-mt-28 z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-2xl p-5 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-center sm:items-start">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center text-3xl sm:text-4xl font-black text-primary-foreground shadow-lg ring-4 ring-background">
                {profile.avatar}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow">
                Lv.{profile.level}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{profile.displayName}</h1>
                <Badge variant="outline" className="w-fit mx-auto sm:mx-0 text-muted-foreground font-mono text-xs">
                  @{profile.gamerTag}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">{profile.bio}</p>

              {/* XP Bar */}
              <div className="mt-3 max-w-xs mx-auto sm:mx-0">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>XP</span>
                  <span>{profile.xp.toLocaleString()} / {profile.maxXp.toLocaleString()}</span>
                </div>
                <Progress value={(profile.xp / profile.maxXp) * 100} className="h-2" />
              </div>

              {/* Stats */}
              <div className="flex gap-6 mt-4 justify-center sm:justify-start">
                <div className="text-center">
                  <p className="text-xl font-black text-foreground">{profile.followers.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-foreground">{profile.following}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-foreground">{profile.recentReviews.length}</p>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 shrink-0">
              <Button size="sm" className="gap-1.5 font-bold">
                <UserPlus className="h-4 w-4" /> Follow
              </Button>
              <Button size="sm" variant="outline">
                <Shield className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Bento Grid */}
      <div className="container px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Sidebar info */}
          <div className="space-y-6">
            {/* Platforms */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <Gamepad2 className="h-4 w-4 text-primary" /> Platforms
              </h3>
              <div className="flex gap-2 flex-wrap">
                {profile.platforms.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-lg text-sm font-medium text-secondary-foreground">
                    {platformIcon(p)}
                    {p}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top Games */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-primary" /> Top 3 Games
              </h3>
              <div className="space-y-3">
                {profile.topGames.map((game, i) => (
                  <Link
                    key={game.id}
                    to={`/reviews/${game.id}`}
                    className="flex items-center gap-3 group rounded-lg p-2 -mx-2 hover:bg-secondary/60 transition-colors"
                  >
                    <span className="text-lg font-black text-muted-foreground w-6 text-center">
                      {i + 1}
                    </span>
                    <img
                      src={game.coverImage}
                      alt={game.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{game.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {game.hoursPlayed}h played
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Achievements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" /> Achievements
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {profile.achievements.map((a) => (
                  <div key={a.label} className="bg-secondary/60 rounded-lg p-3 text-center group hover:bg-secondary transition-colors">
                    <span className="text-2xl">{a.icon}</span>
                    <p className="text-xs font-bold text-foreground mt-1">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Reviews Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-foreground">Recent Reviews</h2>
              <Badge variant="secondary" className="font-mono text-xs">{profile.recentReviews.length} total</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.recentReviews.map((review, i) => (
                <motion.div
                  key={review.gameId + review.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 * i }}
                >
                  <Link
                    to={`/reviews/${review.gameId}`}
                    className="group block rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                  >
                    {/* Game Image */}
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={review.gameImage}
                        alt={review.gameName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <StarRating rating={review.rating} />
                      </div>
                    </div>

                    {/* Review Content */}
                    <div className="p-4">
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                        {review.gameName}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {review.excerpt}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3" /> {review.likes}
                        </div>
                        <span className="text-xs text-primary font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                          Read More <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
