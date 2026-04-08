import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [step, setStep] = useState<number>(1);

  useEffect(() => {
    if (!isAuthenticated || !user) { setOnboardingDone(null); return; }

    supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setOnboardingDone(data?.onboarding_completed ?? false);
        setStep(data?.onboarding_step ?? 1);
      });
  }, [isAuthenticated, user]);

  // Still loading auth or profile check
  if (isLoading || (isAuthenticated && onboardingDone === null)) return null;

  // Not logged in — let the page handle its own auth gate
  if (!isAuthenticated) return <>{children}</>;

  // Logged in but onboarding incomplete — redirect
  if (!onboardingDone) {
    return <Navigate to={`/onboarding/step-${step}`} replace />;
  }

  return <>{children}</>;
}
