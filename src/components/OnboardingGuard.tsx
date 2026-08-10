import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase, isDemoMode } from '@/integrations/supabase/client';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [accountState, setAccountState] = useState<{ status: string; deletionDate: string | null } | null>(null);
  const [recovering, setRecovering] = useState(false);
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
      .select('onboarding_completed, onboarding_step, account_status, scheduled_deletion_at')
      .eq('id', user.id)
      .single()
      .then(({ data, error: sbError }) => {
        if (sbError?.code === 'PGRST116') {
          // No profile row yet (trigger may still be running) — treat as new user → onboarding
          setOnboardingDone(false);
          return;
        }
        if (sbError) { setOnboardingDone(true); return; } // unknown error — let through
        setAccountState({ status: data?.account_status ?? 'active', deletionDate: data?.scheduled_deletion_at ?? null });
        setOnboardingDone(data?.onboarding_completed ?? false);
      })
      .catch(() => setOnboardingDone(true));
  }, [isAuthenticated, user]);

  async function recoverAccount() {
    setRecovering(true);
    const { error } = await supabase.rpc('request_account_action', { p_action: 'recover' });
    if (!error) window.location.reload();
    setRecovering(false);
  }

  if (isAuthenticated && accountState && accountState.status !== 'active') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-lg">
          <h1 className="text-3xl font-bold">Recover Your Account</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {accountState.status === 'pending_deletion'
              ? `Your account is scheduled for deletion${accountState.deletionDate ? ` on ${new Date(accountState.deletionDate).toLocaleDateString()}` : ' after 30 days'}. Recover it now to keep your profile, games, and reviews.`
              : 'Your account is deactivated. Recover it to restore your profile, games, and reviews.'}
          </p>
          <Button className="mt-6 w-full gap-2" onClick={recoverAccount} disabled={recovering}>
            {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Recover Account
          </Button>
        </div>
      </div>
    );
  }

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
          <p className="text-muted-foreground animate-pulse font-medium">Loading Talus...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
