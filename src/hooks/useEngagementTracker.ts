import { useState, useEffect, useCallback, useRef } from "react";

const SESSION_KEY = "levelupxp_softblock_dismissed";

interface EngagementConfig {
  scrollThreshold: number; // viewport heights scrolled
  viewThreshold: number;   // distinct cards viewed
  timeThreshold: number;   // seconds on site
}

const DEFAULT_CONFIG: EngagementConfig = {
  scrollThreshold: 6,
  viewThreshold: 10,
  timeThreshold: 90,
};

export function useEngagementTracker(config: EngagementConfig = DEFAULT_CONFIG) {
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(SESSION_KEY) === "true";
  });
  const viewedCards = useRef(new Set<string>());
  const startTime = useRef(Date.now());
  const triggered = useRef(false);

  const trigger = useCallback(() => {
    if (triggered.current || isDismissed) return;
    triggered.current = true;
    setShouldShowModal(true);
  }, [isDismissed]);

  // Scroll tracking
  useEffect(() => {
    if (isDismissed) return;
    const handleScroll = () => {
      const scrolled = window.scrollY / window.innerHeight;
      if (scrolled >= config.scrollThreshold) trigger();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [config.scrollThreshold, trigger, isDismissed]);

  // Time tracking
  useEffect(() => {
    if (isDismissed) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed >= config.timeThreshold) {
        trigger();
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [config.timeThreshold, trigger, isDismissed]);

  // Card view tracking
  const trackCardView = useCallback(
    (cardId: string) => {
      if (isDismissed) return;
      viewedCards.current.add(cardId);
      if (viewedCards.current.size >= config.viewThreshold) trigger();
    },
    [config.viewThreshold, trigger, isDismissed]
  );

  const dismiss = useCallback(() => {
    setShouldShowModal(false);
    setIsDismissed(true);
    localStorage.setItem(SESSION_KEY, "true");
  }, []);

  return { shouldShowModal, dismiss, trackCardView };
}
