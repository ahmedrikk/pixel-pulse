import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { getProfile, type Profile } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<Profile | null>;
  setCachedProfile: (profile: Profile | null) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function cacheKey(userId: string) {
  return `talus-profile:${userId}`;
}

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) as Profile : null;
  } catch {
    return null;
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthGate();
  const [profile, setProfile] = useState<Profile | null>(() =>
    user?.id ? readCachedProfile(user.id) : null
  );
  const [isLoading, setIsLoading] = useState(isAuthLoading);

  const setCachedProfile = useCallback((next: Profile | null) => {
    setProfile(next);
    if (!user?.id) return;
    try {
      if (next) window.localStorage.setItem(cacheKey(user.id), JSON.stringify(next));
      else window.localStorage.removeItem(cacheKey(user.id));
    } catch {
      // Storage can be unavailable in privacy mode; in-memory cache still works.
    }
  }, [user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setCachedProfile(null);
      setIsLoading(false);
      return null;
    }
    const next = await getProfile(user.id);
    setCachedProfile(next);
    setIsLoading(false);
    return next;
  }, [setCachedProfile, user?.id]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated || !user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const cached = readCachedProfile(user.id);
    if (cached) {
      setProfile(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    refreshProfile();

    const channel = supabase
      .channel(`profile-widget-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setCachedProfile(payload.new as Profile)
      )
      .subscribe();

    const handleProfileUpdated = (event: Event) => {
      const next = (event as CustomEvent<Profile>).detail;
      if (next?.id === user.id) setCachedProfile(next);
      else refreshProfile();
    };
    window.addEventListener("talus:profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("talus:profile-updated", handleProfileUpdated);
      supabase.removeChannel(channel);
    };
  }, [
    isAuthLoading,
    isAuthenticated,
    refreshProfile,
    setCachedProfile,
    user?.id,
  ]);

  const visibleProfile = useMemo(() => {
    if (!user?.id) return null;
    if (profile?.id === user.id) return profile;
    return readCachedProfile(user.id);
  }, [profile, user?.id]);

  const value = useMemo(() => ({
    profile: visibleProfile,
    isLoading,
    refreshProfile,
    setCachedProfile,
  }), [isLoading, refreshProfile, setCachedProfile, visibleProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}
