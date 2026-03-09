import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { GatedAction, PendingAction } from "@/types/feed";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AuthGateContextType {
  isAuthModalOpen: boolean;
  authModalContext: GatedAction | null;
  pendingAction: PendingAction | null;
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  openAuthModal: (action: GatedAction, pendingData?: Omit<PendingAction, "type">) => void;
  closeAuthModal: () => void;
  executePendingAction: () => void;
  clearPendingAction: () => void;
  signOut: () => Promise<void>;
}

const AuthGateContext = createContext<AuthGateContextType | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalContext, setAuthModalContext] = useState<GatedAction | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        setIsAuthenticated(!!session?.user);
      } catch (err) {
        console.error("Auth check error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openAuthModal = useCallback((action: GatedAction, pendingData?: Omit<PendingAction, "type">) => {
    setAuthModalContext(action);
    setPendingAction({ type: action, ...pendingData });
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthModalContext(null);
  }, []);

  const executePendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Always provide the context, even during loading
  const value: AuthGateContextType = {
    isAuthModalOpen,
    authModalContext,
    pendingAction,
    isAuthenticated,
    user,
    isLoading,
    openAuthModal,
    closeAuthModal,
    executePendingAction,
    clearPendingAction,
    signOut,
  };

  return (
    <AuthGateContext.Provider value={value}>
      {children}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}

// Hook to check if action requires auth
export function useGatedAction() {
  const { isAuthenticated, openAuthModal, user, isLoading } = useAuthGate();

  const requireAuth = useCallback(<T extends (...args: Parameters<T>) => ReturnType<T>>(
    action: GatedAction,
    handler: T,
    pendingData?: Omit<PendingAction, "type">
  ) => {
    return (...args: Parameters<T>): ReturnType<T> | void => {
      if (!isAuthenticated) {
        openAuthModal(action, pendingData);
        return;
      }
      return handler(...args);
    };
  }, [isAuthenticated, openAuthModal]);

  return { requireAuth, isAuthenticated, user, isLoading };
}
