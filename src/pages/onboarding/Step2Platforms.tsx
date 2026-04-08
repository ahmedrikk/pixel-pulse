import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { PlatformCard } from '@/components/onboarding/PlatformCard';
import { SkillLevelTag } from '@/components/onboarding/SkillLevelTag';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { saveStep2 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

const PLATFORMS = [
  { id: 'pc',          label: 'PC / Steam',   icon: '🖥️', color: '#1b2838' },
  { id: 'playstation', label: 'PlayStation',   icon: '🎮', color: '#003087' },
  { id: 'xbox',        label: 'Xbox',          icon: '❎', color: '#107C10' },
  { id: 'nintendo',    label: 'Nintendo',      icon: '🍄', color: '#E4000F' },
  { id: 'mobile',      label: 'Mobile',        icon: '📱', color: '#FF6900' },
  { id: 'cloud',       label: 'Cloud Gaming',  icon: '☁️', color: '#00B4D8' },
];

const SKILL_LEVELS = [
  { value: 'fun',         label: 'Just for fun',  description: 'Easy trivia, casual tone' },
  { value: 'casual',      label: 'Casual',         description: 'Medium trivia, standard tone' },
  { value: 'competitive', label: 'Competitive',    description: 'Hard trivia, pro-level context' },
  { value: 'semipro',     label: 'Semi-pro',       description: 'Expert trivia, heavy esports' },
];

export default function Step2Platforms() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep2 } = useOnboardingState();

  const [selected, setSelected] = useState<string[]>(state.step2?.platforms ?? []);
  const [skill, setSkill]       = useState(state.step2?.skillLevel ?? 'casual');
  const [loading, setLoading]   = useState(false);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleContinue() {
    if (!user || selected.length === 0) return;
    setLoading(true);
    try {
      await saveStep2(user.id, { platforms: selected, skillLevel: skill });
      setStep2({ platforms: selected, skillLevel: skill });
      navigate('/onboarding/step-3');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={2}
      title="Where do you game?"
      subtitle="Select all platforms you play on. We'll personalise your feed."
      showBack
      continueDisabled={selected.length === 0}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-8">
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {PLATFORMS.map(p => (
              <PlatformCard
                key={p.id}
                {...p}
                selected={selected.includes(p.id)}
                onToggle={toggle}
              />
            ))}
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-red-500 mt-2">Select at least one platform to continue.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-3">Skill level</label>
          <div className="flex flex-wrap gap-2">
            {SKILL_LEVELS.map(s => (
              <SkillLevelTag
                key={s.value}
                value={s.value}
                label={s.label}
                description={s.description}
                selected={skill === s.value}
                onSelect={setSkill}
              />
            ))}
          </div>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
