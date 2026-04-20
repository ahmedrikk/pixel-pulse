import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase, isDemoMode } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      // If not logged in — no onboarding check needed, guests can pass
      if (!isAuthenticated || !user) {
        setOnboardingDone(true);
        return;
      }

      // Synchronous check for Demo Mode
      if (isDemoMode()) {
        setOnboardingDone(true);
        return;
      }

      // Safety timeout for real users: if profile check takes > 5s, fallback to proceed
      const timeout = setTimeout(() => {
        if (onboardingDone === null) {
          console.warn('OnboardingGuard: Profile check timed out. Proceeding cautiously.');
          setOnboardingDone(true); 
        }
      }, 5000);

      supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('id', user.id)
        .single()
        .then(({ data, error: sbError }) => {
          clearTimeout(timeout);
          if (sbError) {
            console.error('OnboardingGuard: Error fetching profile:', sbError);
            setOnboardingDone(true);
            return;
          }
          setOnboardingDone(data?.onboarding_completed ?? false);
          setStep(data?.onboarding_step ?? 1);
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error('OnboardingGuard: Catch block error:', err);
          setOnboardingDone(true);
        });

      return () => clearTimeout(timeout);
    };

    checkOnboarding();
  }, [isAuthenticated, user]);

  // Still loading auth or profile check
  if (isLoading || (isAuthenticated && onboardingDone === null)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Initializing LevelUp...</p>
        </div>
      </div>
    );
  }

  // Not logged in — let the page handle its own auth gate
  if (!isAuthenticated) return <>{children}</>;

  // Logged in but onboarding incomplete — redirect
  if (!onboardingDone) {
    return <Navigate to={`/onboarding/step-${step}`} replace />;
  }

  return <>{children}</>;
}
