import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { GatedAction, PendingAction } from "@/types/feed";

interface AuthGateContextType {
  isAuthModalOpen: boolean;
  authModalContext: GatedAction | null;
  pendingAction: PendingAction | null;
  isAuthenticated: boolean;
  openAuthModal: (action: GatedAction, pendingData?: Omit<PendingAction, "type">) => void;
  closeAuthModal: () => void;
  setAuthenticated: (value: boolean) => void;
  executePendingAction: () => void;
  clearPendingAction: () => void;
}

const AuthGateContext = createContext<AuthGateContextType | null>(null);

// Mock auth state - in real app, this comes from Supabase Auth
const MOCK_USER = null; // Set to null to simulate logged out state

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalContext, setAuthModalContext] = useState<GatedAction | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(MOCK_USER !== null);

  const openAuthModal = useCallback((action: GatedAction, pendingData?: Omit<PendingAction, "type">) => {
    setAuthModalContext(action);
    setPendingAction({ type: action, ...pendingData });
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthModalContext(null);
  }, []);

  const setAuthenticated = useCallback((value: boolean) => {
    setIsAuthenticated(value);
    if (value) {
      closeAuthModal();
    }
  }, [closeAuthModal]);

  const executePendingAction = useCallback(() => {
    // In real implementation, this would execute the stored pending action
    // For now, just clear it after successful auth
    setPendingAction(null);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return (
    <AuthGateContext.Provider
      value={{
        isAuthModalOpen,
        authModalContext,
        pendingAction,
        isAuthenticated,
        openAuthModal,
        closeAuthModal,
        setAuthenticated,
        executePendingAction,
        clearPendingAction,
      }}
    >
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
  const { isAuthenticated, openAuthModal } = useAuthGate();

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

  return { requireAuth, isAuthenticated };
}
