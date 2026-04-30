import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase, isDemoMode } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // Show spinner for at most 2 seconds, then show children regardless
  const [spinnerExpired, setSpinnerExpired] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSpinnerExpired(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Profile check — re-runs whenever auth state resolves
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setOnboardingDone(null); // reset so we re-check if auth resolves later
      return;
    }
    if (isDemoMode()) {
      setOnboardingDone(true);
      return;
    }

    setOnboardingDone(null); // show spinner while checking profile

    supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('id', user.id)
      .single()
      .then(({ data, error: sbError }) => {
        if (sbError) { setOnboardingDone(true); return; }
        setOnboardingDone(data?.onboarding_completed ?? false);
      })
      .catch(() => setOnboardingDone(true));
  }, [isAuthenticated, user]);

  // Redirect authenticated user to onboarding — happens even after spinner expired
  // so users who complete auth after the 2s window still get redirected correctly
  if (isAuthenticated && onboardingDone === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // Spinner: only while auth or profile check is pending AND within 2-second window
  const stillChecking = isLoading || (isAuthenticated && onboardingDone === null);
  if (!spinnerExpired && stillChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Initializing LevelUp...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
