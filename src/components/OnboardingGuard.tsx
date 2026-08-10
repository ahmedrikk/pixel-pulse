import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase, isDemoMode } from '@/integrations/supabase/client';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingState, setOnboardingState] = useState<'checking' | 'complete' | 'required' | 'error'>('checking');
  const [accountState, setAccountState] = useState<{ status: string; deletionDate: string | null } | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Profile check — re-runs whenever auth state resolves
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setOnboardingState('checking');
      setAccountState(null);
      return;
    }
    if (isDemoMode()) {
      setOnboardingState('complete');
      return;
    }

    let cancelled = false;
    setOnboardingState('checking');
    setAccountState(null);

    void supabase
      .from('profiles')
      .select('onboarding_completed, account_status, scheduled_deletion_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: sbError }) => {
        if (cancelled) return;
        if (sbError) {
          console.error('Unable to verify onboarding state:', sbError);
          setOnboardingState('error');
          return;
        }

        // A missing profile is a new/unboarded account. The auth trigger normally
        // creates this row before the session becomes available.
        if (!data) {
          setOnboardingState('required');
          return;
        }

        setAccountState({ status: data.account_status ?? 'active', deletionDate: data.scheduled_deletion_at ?? null });
        setOnboardingState(data.onboarding_completed ? 'complete' : 'required');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Unable to verify onboarding state:', error);
        setOnboardingState('error');
      });

    return () => { cancelled = true; };
  }, [isAuthenticated, retryCount, user]);

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

  // The persisted flag, not the auth provider's "new user" status, decides this.
  if (isAuthenticated && onboardingState === 'required') {
    return <Navigate to="/onboarding" replace />;
  }

  if (isAuthenticated && onboardingState === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-lg">
          <h1 className="text-2xl font-bold">We Could Not Verify Your Profile</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account is signed in, but Talus could not confirm whether onboarding is complete. Retry to continue safely.
          </p>
          <Button className="mt-6 w-full gap-2" onClick={() => setRetryCount((count) => count + 1)}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  // Never expose an authenticated route until the persisted flag is resolved.
  const stillChecking = isLoading || (isAuthenticated && onboardingState === 'checking');
  if (stillChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Loading Talus...</p>
        </div>
      </div>
    );
  }

  return !isAuthenticated || onboardingState === 'complete' ? <>{children}</> : null;
}
