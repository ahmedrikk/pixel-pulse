import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase, isDemoMode } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [step, setStep] = useState<number>(1);
  // Hard cap: never spin longer than 6s total regardless of auth/profile state
  const [timedOut, setTimedOut] = useState(false);
  const globalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    globalTimeout.current = setTimeout(() => {
      setTimedOut(true);
    }, 6000);
    return () => {
      if (globalTimeout.current) clearTimeout(globalTimeout.current);
    };
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!isAuthenticated || !user) {
        setOnboardingDone(true);
        return;
      }

      if (isDemoMode()) {
        setOnboardingDone(true);
        return;
      }

      const timeout = setTimeout(() => {
        setOnboardingDone(true);
      }, 5000);

      supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('id', user.id)
        .single()
        .then(({ data, error: sbError }) => {
          clearTimeout(timeout);
          if (sbError) {
            setOnboardingDone(true);
            return;
          }
          setOnboardingDone(data?.onboarding_completed ?? false);
          setStep(data?.onboarding_step ?? 1);
        })
        .catch(() => {
          clearTimeout(timeout);
          setOnboardingDone(true);
        });
    };

    checkOnboarding();
  }, [isAuthenticated, user]);

  // Hard timeout fired — just render children rather than spin forever
  if (timedOut) return <>{children}</>;

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

  if (!isAuthenticated) return <>{children}</>;

  if (!onboardingDone) {
    return <Navigate to={`/onboarding/step-${step}`} replace />;
  }

  return <>{children}</>;
}
