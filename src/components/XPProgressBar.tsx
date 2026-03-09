import { motion, AnimatePresence } from "framer-motion";
import { useXP } from "@/contexts/XPContext";
import { Sparkles } from "lucide-react";

export function XPProgressBar() {
  const { state, floatingXPs, justLeveledUp } = useXP();
  const progress = (state.currentLevelXP / state.xpForNextLevel) * 100;

  return (
    <div className="relative w-full">
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-foreground">
          Battle Pass Progress
        </span>
      </div>

      {/* Track */}
      <div className="relative h-3 w-full rounded-full bg-secondary/60 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
            boxShadow: "0 0 12px hsl(186 100% 50% / 0.5)",
          }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {/* XP numbers */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] font-semibold text-muted-foreground">{state.level - 1}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">{state.level}</span>
      </div>

      {/* Floating XP indicators */}
      <AnimatePresence>
        {floatingXPs.map((f) => (
          <motion.span
            key={f.id}
            className="absolute left-1/2 -top-1 text-xs font-black pointer-events-none"
            style={{ color: "hsl(142 71% 45%)" }}
            initial={{ opacity: 1, y: 0, x: "-50%" }}
            animate={{ opacity: 0, y: -32, x: "-50%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            +{f.amount} XP
          </motion.span>
        ))}
      </AnimatePresence>

      {/* Level Up celebration */}
      <AnimatePresence>
        {justLeveledUp && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 border border-primary/40">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-black text-primary">LEVEL UP!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
