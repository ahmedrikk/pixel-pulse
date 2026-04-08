import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DesktopLeftPanel } from '@/components/onboarding/DesktopLeftPanel';
import { StepProgressBar } from '@/components/onboarding/StepProgressBar';

interface OnboardingLayoutProps {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  showBack?: boolean;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  onContinue: () => void;
  children: ReactNode;
}

export function OnboardingLayout({
  step, title, subtitle, showBack = false,
  continueLabel = 'Continue', continueDisabled = false, continueLoading = false,
  onContinue, children,
}: OnboardingLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <DesktopLeftPanel currentStep={step} />

      <div className="flex flex-1 flex-col">
        <div className="md:hidden px-6 pt-5">
          <StepProgressBar currentStep={step} />
        </div>

        <div className="flex flex-1 flex-col md:items-center md:justify-center px-6 pt-6 pb-24 md:pb-0 md:px-16 md:py-20">
          <div className="w-full max-w-[480px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#534AB7] mb-2">
              Step {step} of 4
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#0A1628] leading-tight mb-2">
              {title}
            </h1>
            <p className="text-sm text-gray-500 mb-8">{subtitle}</p>

            <div className="animate-in slide-in-from-right-8 duration-200">
              {children}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t md:border-0 px-6 py-4 md:px-0 md:py-0">
          <div className="max-w-[480px] mx-auto md:mx-0 flex items-center justify-between gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled || continueLoading}
              className="flex items-center gap-2 rounded-xl bg-[#534AB7] px-6 py-3 text-sm font-semibold text-white transition-all
                md:w-40 justify-center
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-[#3C3489] active:scale-[0.98]
                max-md:flex-1"
            >
              {continueLoading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : continueLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
