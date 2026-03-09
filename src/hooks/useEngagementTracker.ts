import { useState, useEffect, useCallback, useRef } from "react";

const SESSION_KEY = "levelupxp_softblock_dismissed";

interface EngagementConfig {
  scrollThreshold: number;
  viewThreshold: number;
  timeThreshold: number;
}

const DEFAULT_CONFIG: EngagementConfig = {
  scrollThreshold: 3,
  viewThreshold: 6,
  timeThreshold: 90,
};

export function useEngagementTracker(
  addXP?: (amount: number) => void,
  config: EngagementConfig = DEFAULT_CONFIG
) {
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const isDismissedRef = useRef(sessionStorage.getItem(SESSION_KEY) === "true");
  const viewedCards = useRef(new Set<string>());
  const startTime = useRef(Date.now());
  const triggered = useRef(false);
  const scrollMilestones = useRef(0);
  const cardMilestones = useRef(0);

  const trigger = useCallback(() => {
    if (triggered.current || isDismissedRef.current) return;
    triggered.current = true;
    setShouldShowModal(true);
  }, []);

  // Scroll tracking + XP
  useEffect(() => {
    if (isDismissedRef.current) return;
    const handleScroll = () => {
      const scrolled = window.scrollY / window.innerHeight;
      const newMilestone = Math.floor(scrolled / 6);
      if (newMilestone > scrollMilestones.current) {
        scrollMilestones.current = newMilestone;
        addXP?.(25);
      }
      if (scrolled >= config.scrollThreshold) trigger();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [config.scrollThreshold, trigger, addXP]);

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

  // Card view tracking + XP
  const trackCardView = useCallback(
    (cardId: string) => {
      if (isDismissedRef.current) return;
      viewedCards.current.add(cardId);
      const size = viewedCards.current.size;
      const newMilestone = Math.floor(size / 10);
      if (newMilestone > cardMilestones.current) {
        cardMilestones.current = newMilestone;
        addXP?.(50);
      }
      if (size >= config.viewThreshold) trigger();
    },
    [config.viewThreshold, trigger, addXP]
  );

  const dismiss = useCallback(() => {
    setShouldShowModal(false);
    isDismissedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, "true");
  }, []);

  return { shouldShowModal, dismiss, trackCardView };
}
