import { useCallback, useRef } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";

export function useEngagementTracker(
  addXP?: (amount: number) => void
) {
  const { incrementArticleScroll, isAuthenticated } = useAuthGate();
  const viewedCards = useRef(new Set<string>());
  const cardMilestones = useRef(0);

  // Card view tracking + XP
  const trackCardView = useCallback(
    (cardId: string) => {
      if (!viewedCards.current.has(cardId)) {
        viewedCards.current.add(cardId);
        
        if (!isAuthenticated) {
          // Increment guest scroll count in AuthGateContext
          incrementArticleScroll();
        } else {
          // Grant XP for logged in users
          const size = viewedCards.current.size;
          const newMilestone = Math.floor(size / 10);
          if (newMilestone > cardMilestones.current) {
            cardMilestones.current = newMilestone;
            addXP?.(50);
          }
        }
      }
    },
    [isAuthenticated, incrementArticleScroll, addXP]
  );

  return { trackCardView };
}
