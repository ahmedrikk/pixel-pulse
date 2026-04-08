import { useState, useCallback } from 'react';
import { Step1Data, Step2Data, Step3Data } from '@/lib/onboardingService';

const SESSION_KEY = 'onboarding_state';

interface OnboardingState {
  step1?: Step1Data;
  step2?: Step2Data;
  step3?: Step3Data;
}

function load(): OnboardingState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: OnboardingState) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(load);

  const setStep1 = useCallback((data: Step1Data) => {
    setState(prev => {
      const next = { ...prev, step1: data };
      save(next);
      return next;
    });
  }, []);

  const setStep2 = useCallback((data: Step2Data) => {
    setState(prev => {
      const next = { ...prev, step2: data };
      save(next);
      return next;
    });
  }, []);

  const setStep3 = useCallback((data: Step3Data) => {
    setState(prev => {
      const next = { ...prev, step3: data };
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState({});
  }, []);

  return { state, setStep1, setStep2, setStep3, clear };
}
