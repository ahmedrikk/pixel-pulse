import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchXPProfile } from "@/lib/xp";

interface XPState {
  totalXP: number;
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
  xpSeason: number;
  tier: number;
  xpToday: number;
}

interface FloatingXP {
  id: string;
  amount: number;
  timestamp: number;
}

interface XPContextType {
  state: XPState;
  addXP: (amount: number) => void;
  floatingXPs: FloatingXP[];
  justLeveledUp: boolean;
  clearLevelUp: () => void;
  enableXP: () => void;
  refreshFromServer: () => Promise<void>;
}

const XP_STORAGE_KEY = "gt_xp_data";
const LOGIN_KEY = "gt_daily_login";

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function computeState(totalXP: number): Omit<XPState, "xpSeason" | "tier" | "xpToday"> {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { totalXP, level, currentLevelXP: remaining, xpForNextLevel: xpForLevel(level) };
}

function loadXP(): number {
  try {
    return parseInt(localStorage.getItem(XP_STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

const XPContext = createContext<XPContextType | null>(null);

export function XPProvider({ children }: { children: ReactNode }) {
  const [totalXP, setTotalXP] = useState(loadXP);
  const [xpSeason, setXpSeason] = useState(0);
  const [tier, setTier] = useState(0);
  const [xpToday, setXpToday] = useState(0);
  const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([]);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const prevLevelRef = useRef(computeState(loadXP()).level);
  const prevTierRef = useRef(0);
  // Debounce Supabase writes — only flush after 3s of inactivity
  const supabaseFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingXPRef = useRef<number | null>(null);
  const canEarnXPRef = useRef(false);

  // Sync from server — pulls xp_season, tier, xp_today from Supabase
  const syncFromServer = useCallback(async (userId: string) => {
    const data = await fetchXPProfile();
    if (!data) return;

    canEarnXPRef.current = true;

    // Merge server season XP with local (use whichever is higher)
    const localXP = loadXP();
    const serverXP = data.xp ?? 0;
    const merged = Math.max(localXP, serverXP);

    if (merged !== localXP) {
      localStorage.setItem(XP_STORAGE_KEY, String(merged));
      setTotalXP(merged);
    }

    setXpSeason(data.xp_season ?? 0);
    setTier(data.tier ?? 0);
    setXpToday(data.xp_today ?? 0);

    // Detect tier-up
    const newTier = data.tier ?? 0;
    if (newTier > prevTierRef.current && prevTierRef.current > 0) {
      setJustLeveledUp(true);
      setTimeout(() => setJustLeveledUp(false), 3000);
    }
    prevTierRef.current = newTier;
  }, []);

  // On login: pull XP from Supabase
  useEffect(() => {
    const handleAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncFromServer(user.id);
      }
    };
    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        syncFromServer(session.user.id);
      } else if (event === "SIGNED_OUT") {
        canEarnXPRef.current = false;
        setXpSeason(0);
        setTier(0);
        setXpToday(0);
        prevTierRef.current = 0;
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromServer]);

  // Refresh from server (call after awardXP)
  const refreshFromServer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await syncFromServer(user.id);
    }
  }, [syncFromServer]);

  // Flush accumulated XP to Supabase (debounced, 3s after last addXP call)
  const flushToSupabase = useCallback((newTotal: number) => {
    if (supabaseFlushTimer.current) clearTimeout(supabaseFlushTimer.current);
    pendingXPRef.current = newTotal;
    supabaseFlushTimer.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || pendingXPRef.current === null) return;
      const xpToWrite = pendingXPRef.current;
      const derived = computeState(xpToWrite);
      await supabase
        .from("profiles")
        .update({ xp: xpToWrite, level: derived.level })
        .eq("id", user.id);
      pendingXPRef.current = null;
    }, 3000);
  }, []);

  // Daily login bonus
  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(LOGIN_KEY) !== today) {
      localStorage.setItem(LOGIN_KEY, today);
      setTimeout(() => addXP(25), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addXP = useCallback((amount: number) => {
    if (!canEarnXPRef.current) return;

    setTotalXP((prev) => {
      const next = prev + amount;
      localStorage.setItem(XP_STORAGE_KEY, String(next));
      flushToSupabase(next);
      return next;
    });
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingXPs((prev) => [...prev, { id, amount, timestamp: Date.now() }]);
    setTimeout(() => {
      setFloatingXPs((prev) => prev.filter((f) => f.id !== id));
    }, 1500);
  }, [flushToSupabase]);

  const state: XPState = {
    ...computeState(totalXP),
    xpSeason,
    tier,
    xpToday,
  };

  // Detect level up (local level system)
  useEffect(() => {
    if (state.level > prevLevelRef.current) {
      setJustLeveledUp(true);
      setTimeout(() => setJustLeveledUp(false), 3000);
    }
    prevLevelRef.current = state.level;
  }, [state.level]);

  const clearLevelUp = useCallback(() => setJustLeveledUp(false), []);
  const enableXP = useCallback(() => { canEarnXPRef.current = true; }, []);

  return (
    <XPContext.Provider value={{ state, addXP, floatingXPs, justLeveledUp, clearLevelUp, enableXP, refreshFromServer }}>
      {children}
    </XPContext.Provider>
  );
}

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error("useXP must be used within XPProvider");
  return ctx;
}
