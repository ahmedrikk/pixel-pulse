import { useState, useEffect, useCallback } from "react";
import { Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface XPNotification {
  id: number;
  amount: number;
  label?: string;
  tierUp?: boolean;
}

let notifId = 0;

export function XPGainOverlay() {
  const [notifications, setNotifications] = useState<XPNotification[]>([]);

  const addNotification = useCallback((detail: { awarded: number; label?: string; tier_up?: boolean }) => {
    if (!detail.awarded || detail.awarded <= 0) return;
    const id = ++notifId;
    setNotifications((prev) => [...prev, { id, amount: detail.awarded, label: detail.label, tierUp: detail.tier_up }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 2800);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addNotification(detail);
    };
    window.addEventListener("xp-gained", handler);
    return () => window.removeEventListener("xp-gained", handler);
  }, [addNotification]);

  return (
    <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border font-bold text-sm ${
              n.tierUp
                ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-yellow-300 shadow-yellow-400/40"
                : "bg-card border-primary/30 text-foreground shadow-primary/20"
            }`}
          >
            <Zap
              className={`h-4 w-4 flex-shrink-0 ${n.tierUp ? "text-black" : "text-primary"}`}
              fill="currentColor"
            />
            <span className={n.tierUp ? "text-black" : "text-primary"}>
              +{n.amount} XP
            </span>
            {n.label && (
              <span className={`font-normal text-xs ${n.tierUp ? "text-black/70" : "text-muted-foreground"}`}>
                {n.label}
              </span>
            )}
            {n.tierUp && (
              <span className="text-black font-black text-xs ml-1">TIER UP!</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
