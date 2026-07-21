import { useCallback, useRef } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";

export function useEngagementTracker() {
  const { incrementArticleScroll, isAuthenticated } = useAuthGate();
  const viewedCards = useRef(new Set<string>());

  // Track unique card views for the guest sign-up cadence.
  const trackCardView = useCallback(
    (cardId: string) => {
      if (!viewedCards.current.has(cardId)) {
        viewedCards.current.add(cardId);
        
        if (!isAuthenticated) {
          // Increment guest scroll count in AuthGateContext
          incrementArticleScroll();
        }
      }
    },
    [isAuthenticated, incrementArticleScroll]
  );

  return { trackCardView };
}
