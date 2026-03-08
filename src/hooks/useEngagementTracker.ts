import { useState, useEffect, useCallback, useRef } from "react";

const SESSION_KEY = "levelupxp_softblock_dismissed";

interface EngagementConfig {
  scrollThreshold: number; // viewport heights scrolled
  viewThreshold: number;   // distinct cards viewed
  timeThreshold: number;   // seconds on site
}

const DEFAULT_CONFIG: EngagementConfig = {
  scrollThreshold: 3,
  viewThreshold: 6,
  timeThreshold: 90,
};

export function useEngagementTracker(config: EngagementConfig = DEFAULT_CONFIG) {
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const isDismissedRef = useRef(sessionStorage.getItem(SESSION_KEY) === "true");
  const viewedCards = useRef(new Set<string>());
  const startTime = useRef(Date.now());
  const triggered = useRef(false);

  const trigger = useCallback(() => {
    if (triggered.current || isDismissedRef.current) return;
    triggered.current = true;
    setShouldShowModal(true);
  }, []);

  // Scroll tracking
  useEffect(() => {
    if (isDismissedRef.current) return;
    const handleScroll = () => {
      const scrolled = window.scrollY / window.innerHeight;
      if (scrolled >= config.scrollThreshold) trigger();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [config.scrollThreshold, trigger]);

  // Time tracking
  useEffect(() => {
    if (isDismissedRef.current) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed >= config.timeThreshold) {
        trigger();
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [config.timeThreshold, trigger]);

  // Card view tracking
  const trackCardView = useCallback(
    (cardId: string) => {
      if (isDismissedRef.current) return;
      viewedCards.current.add(cardId);
      if (viewedCards.current.size >= config.viewThreshold) trigger();
    },
    [config.viewThreshold, trigger]
  );

  const dismiss = useCallback(() => {
    setShouldShowModal(false);
    isDismissedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, "true");
  }, []);

  return { shouldShowModal, dismiss, trackCardView };
}
