import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useXP } from "@/contexts/XPContext";
import { Sparkles } from "lucide-react";

const MOCK_USER = {
  initials: "GT",
  displayName: "@GamerTag_X",
  handle: "@gamertag",
  bio: "Indie game enthusiast & RPG lover. Always hunting for hidden gems.",
  emoji: "🎮",
  following: 142,
  followers: 891,
};

export function UserProfileCard() {
  const [isHovered, setIsHovered] = useState(false);
  const { level, currentXP, xpNeeded, progress, justLeveledUp } = useXP();

  return (
    <motion.div
      className="bg-card rounded-2xl border overflow-hidden card-shadow cursor-pointer"
      whileHover={{ scale: 1.02, boxShadow: "0 8px 30px -10px hsl(var(--foreground) / 0.12)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=200&fit=crop"
          alt="Geometric architecture banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/30" />

        <div className="absolute -bottom-8 left-5">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-foreground shadow-lg border-[3px] border-card"
            style={{
              background: "linear-gradient(135deg, hsl(142 71% 45%), hsl(186 100% 50%))",
            }}
            animate={isHovered ? { scale: 1.08 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            {MOCK_USER.initials}
          </motion.div>
        </div>

        <div className="absolute bottom-1 left-24">
          <p className="text-sm font-bold text-foreground drop-shadow-sm leading-tight">
            {MOCK_USER.displayName}
          </p>
          <p className="text-xs text-muted-foreground drop-shadow-sm">
            {MOCK_USER.handle}
          </p>
        </div>
      </div>

      {/* Bio */}
      <div className="pt-10 px-5 pb-4">
        <p className="text-sm text-foreground leading-relaxed">
          {MOCK_USER.bio}
        </p>
        <p className="mt-1 text-base">{MOCK_USER.emoji}</p>

        {/* XP Progress Bar */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <AnimatePresence>
                {justLeveledUp && (
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500 }}
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="text-xs font-bold text-foreground">
                Level {level}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {currentXP} / {xpNeeded} XP
            </span>
          </div>

          <div className="relative h-3 w-full rounded-full overflow-hidden bg-secondary/60">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
                boxShadow: "0 0 12px hsl(186 100% 50% / 0.5)",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>
        </div>

        {/* Level Up Banner */}
        <AnimatePresence>
          {justLeveledUp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-center text-xs font-bold text-accent py-1.5 rounded-md"
              style={{
                background: "linear-gradient(90deg, hsl(142 71% 45% / 0.15), hsl(186 100% 50% / 0.15))",
              }}
            >
              🎉 Level Up! You reached Level {level}!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{MOCK_USER.following}</span>
            <span className="text-sm text-muted-foreground">Following</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{MOCK_USER.followers}</span>
            <span className="text-sm text-muted-foreground">Followers</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
