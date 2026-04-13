import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { DesktopLeftPanel } from '@/components/onboarding/DesktopLeftPanel';
import { completeOnboarding } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useXP } from '@/contexts/XPContext';

export default function Step4Confirmation() {
  const { user } = useAuthGate();
  const { enableXP, addXP } = useXP();
  const navigate = useNavigate();
  const { state, clear } = useOnboardingState();
  const awarded = useRef(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  useEffect(() => {
    if (!user || awarded.current) return;
    awarded.current = true;
    completeOnboarding(user.id).then(xp => {
      // Unlock XP earning immediately — user is now fully onboarded
      enableXP();
      setXpAwarded(xp);
      if (xp > 0) {
        addXP(xp);
        window.dispatchEvent(new CustomEvent('xp-gained', {
          detail: { awarded: xp, label: 'Profile Complete!', tier_up: false },
        }));
      }
    });
  }, [user, enableXP, addXP]);

  function goToFeed() {
    clear();
    navigate('/');
  }

  const { step1, step2, step3 } = state;
  const displayName = step1?.displayName ?? user?.email?.split('@')[0] ?? 'Gamer';
  const platforms   = (step2?.platforms ?? []).join(', ') || '—';
  const gameCount   = step3?.favGameIds.length ?? 0;
  const genres      = (step3?.favGenres ?? []).slice(0, 3).join(', ') || 'Not set';

  return (
    <div className="flex min-h-screen">
      <DesktopLeftPanel currentStep={4} />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-5xl animate-bounce">🎮</div>
          <div>
            <h1 className="text-2xl font-bold text-[#0A1628]">Profile complete!</h1>
            <p className="text-gray-500 mt-2">You're in, {displayName}. Season 1 has begun.</p>
          </div>

          {xpAwarded > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-[#534AB7] px-5 py-2 text-white text-sm font-semibold">
              +{xpAwarded} XP — Profile XP added to your Battle Pass
            </div>
          )}

          <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-5 text-left text-sm">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Username</span>
                <span className="font-medium">@{step1?.username ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Platforms</span>
                <span className="font-medium">{platforms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Games</span>
                <span className="font-medium">{gameCount > 0 ? `${gameCount} selected` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Genres</span>
                <span className={`font-medium ${genres === 'Not set' ? 'text-gray-400' : ''}`}>{genres}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Season tier</span>
                <span className="font-medium text-[#534AB7]">Tier 1 · 50 XP</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">You can edit all of this from your profile at any time.</p>

          <button
            onClick={goToFeed}
            className="w-full rounded-xl bg-[#534AB7] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#3C3489] transition-colors"
          >
            Go to your feed →
          </button>
        </div>
      </div>
    </div>
  );
}
