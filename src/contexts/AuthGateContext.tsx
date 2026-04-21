import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { GatedAction, PendingAction } from "@/types/feed";
import { supabase, isDemoMode, MOCK_USER } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

interface AuthGateContextType {
  isAuthModalOpen: boolean;
  authModalContext: GatedAction | null;
  pendingAction: PendingAction | null;
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  openAuthModal: (action: GatedAction, pendingData?: Omit<PendingAction, "type">) => void;
  openSignupPrompt: () => void;
  closeAuthModal: (source?: "x_button" | "overlay" | "continue_link" | "swipe") => void;
  executePendingAction: () => void;
  clearPendingAction: () => void;
  signOut: () => Promise<void>;
  articleScrollCount: number;
  incrementArticleScroll: () => void;
}

const AuthGateContext = createContext<AuthGateContextType | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalContext, setAuthModalContext] = useState<GatedAction | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track scroll count for guest
  const [articleScrollCount, setArticleScrollCount] = useState(() => {
    return parseInt(sessionStorage.getItem('guest_article_views') || '0');
  });

  const checkAndShowPopup = useCallback((trigger: GatedAction, pendingData?: Omit<PendingAction, "type">) => {
    const isAuthed = !!user;
    if (isAuthed) return false;
    
    const blockedRoutes = ['/login', '/signup', '/onboarding'];
    // Cannot use useLocation here since AuthGateProvider is outside BrowserRouter in App.tsx
    if (blockedRoutes.some(r => window.location.pathname.startsWith(r))) return false;
    
    // Only apply suppression rules for passive triggers (scroll)
    if (trigger === 'scroll') {
      const dismissed = localStorage.getItem('auth_popup_dismissed_at');
      if (dismissed && (Date.now() - Number(dismissed)) < 7 * 86400000) return false;
      if (sessionStorage.getItem('auth_popup_shown')) return false;
    }

    sessionStorage.setItem('auth_popup_shown', 'true');
    setAuthModalContext(trigger);
    
    // Store pending action
    if (trigger !== 'scroll' && trigger !== 'signup_prompt' && trigger !== 'battlepass') {
      const action: PendingAction = { type: trigger, ...pendingData };
      setPendingAction(action);
      sessionStorage.setItem('pending_action', JSON.stringify(action));
    } else {
      setPendingAction(null);
    }
    
    setIsAuthModalOpen(true);
    return true;
  }, [user]);

  const incrementArticleScroll = useCallback(() => {
    const isAuthed = !!user;
    if (isAuthed) return;
    setArticleScrollCount(prev => {
      const next = prev + 1;
      sessionStorage.setItem('guest_article_views', String(next));
      if (next === 3) {
        setTimeout(() => {
          checkAndShowPopup('scroll');
        }, 5000);
      }
      return next;
    });
  }, [user, checkAndShowPopup]);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Synchronous check for Demo Mode from client
        if (isDemoMode()) {
          console.log("AuthGate: Running in Demo Mode — guest passthrough");
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      const isAuthed = !!currentUser;
      
      // If just logged in
      if (isAuthed && !isAuthenticated) {
        try {
          // Check onboarding
          const { data } = await supabase.from('profiles').select('onboarding_completed, display_name').eq('id', currentUser.id).single();
          
          if (data?.onboarding_completed) {
            toast.success(`Welcome back, ${data.display_name || 'Gamer'}!`);
            
            // Execute pending locally (consumer calls executePendingAction)
            const pending = sessionStorage.getItem('pending_action');
            if (pending) {
              setPendingAction(JSON.parse(pending));
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      setUser(currentUser);
      setIsAuthenticated(isAuthed);
      
      // If auth drops
      if (!isAuthed) {
        setPendingAction(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isAuthenticated]);

  const openAuthModal = useCallback((action: GatedAction, pendingData?: Omit<PendingAction, "type">) => {
    checkAndShowPopup(action, pendingData);
  }, [checkAndShowPopup]);

  const openSignupPrompt = useCallback(() => {
    checkAndShowPopup('signup_prompt');
  }, [checkAndShowPopup]);

  const closeAuthModal = useCallback((source?: "x_button" | "overlay" | "continue_link" | "swipe") => {
    setIsAuthModalOpen(false);
    // Timeout to allow exit animation if we are using framer motion AnimatePresence
    setTimeout(() => {
      setAuthModalContext(null);
    }, 300);
    
    if (source) {
      localStorage.setItem('auth_popup_dismissed_at', String(Date.now()));
    }
  }, []);

  const executePendingAction = useCallback(() => {
    setPendingAction(null);
    sessionStorage.removeItem('pending_action');
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
    sessionStorage.removeItem('pending_action');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value: AuthGateContextType = {
    isAuthModalOpen,
    authModalContext,
    pendingAction,
    isAuthenticated,
    user,
    isLoading,
    openAuthModal,
    openSignupPrompt,
    closeAuthModal,
    executePendingAction,
    clearPendingAction,
    signOut,
    articleScrollCount,
    incrementArticleScroll,
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
