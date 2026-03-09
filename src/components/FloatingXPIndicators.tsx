import { motion, AnimatePresence } from "framer-motion";
import { useXP } from "@/contexts/XPContext";

export function FloatingXPIndicators() {
  const { floatingXPs } = useXP();

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <AnimatePresence>
        {floatingXPs.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, y: f.y, x: f.x, scale: 0.5 }}
            animate={{ opacity: 0, y: f.y - 80, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute text-sm font-black"
            style={{
              background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 10px hsl(186 100% 50% / 0.3)",
            }}
          >
            +{f.amount} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
