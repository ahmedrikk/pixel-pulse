import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { AvatarPicker, AvatarValue } from '@/components/onboarding/AvatarPicker';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { checkUsernameAvailable, saveStep1 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

function generateUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 18);
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function Step1Identity() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep1 } = useOnboardingState();

  const [displayName, setDisplayName] = useState(state.step1?.displayName ?? '');
  const [username, setUsername]       = useState(state.step1?.username ?? '');
  const [bio, setBio]                 = useState(state.step1?.bio ?? '');
  const [avatar, setAvatar]           = useState<AvatarValue>(
    state.step1
      ? { type: state.step1.avatarType, initials: state.step1.avatarInitials, color: state.step1.avatarColor, url: state.step1.avatarUrl } as AvatarValue
      : { type: 'initials', initials: 'GP', color: '#534AB7', url: null }
  );
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [loading, setLoading] = useState(false);

  // Auto-generate username from display name
  useEffect(() => {
    if (!displayName) { setUsername(''); return; }
    setUsername(generateUsername(displayName));
  }, [displayName]);

  // Update avatar initials when username changes
  useEffect(() => {
    const initials = (displayName || username).slice(0, 2).toUpperCase() || 'GP';
    if (avatar.type === 'initials') {
      setAvatar(prev => ({ ...prev, initials }));
    }
  }, [displayName, username]);

  // Debounced username check
  const checkUsername = useCallback(async (u: string) => {
    if (u.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const available = await checkUsernameAvailable(u);
    setUsernameStatus(available ? 'available' : 'taken');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (username) checkUsername(username); }, 400);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const canContinue = displayName.length >= 2 && username.length >= 3 && usernameStatus === 'available';

  async function handleContinue() {
    if (!user || !canContinue) return;
    setLoading(true);
    try {
      const data = {
        displayName,
        username,
        avatarUrl: avatar.url,
        avatarType: avatar.type,
        avatarInitials: avatar.initials,
        avatarColor: avatar.color,
        bio,
      };
      await saveStep1(user.id, data);
      setStep1(data);
      navigate('/onboarding/step-2');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = usernameStatus === 'checking' ? '⏳'
    : usernameStatus === 'available' ? '✓'
    : usernameStatus === 'taken' ? '✗' : '';
  const statusColor = usernameStatus === 'available' ? 'text-green-600'
    : usernameStatus === 'taken' ? 'text-red-500' : 'text-gray-400';

  return (
    <OnboardingLayout
      step={1}
      title="Let's set up your profile"
      subtitle="This is how other players will see you on Game Pulse."
      continueDisabled={!canContinue}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-6">
        <AvatarPicker
          username={username}
          userId={user?.id ?? ''}
          value={avatar}
          onChange={setAvatar}
        />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Display name *</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value.slice(0, 30))}
            placeholder="GamerPulse99"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#534AB7]"
          />
          {displayName.length > 0 && displayName.length < 2 && (
            <p className="text-xs text-red-500 mt-1">Name must be 2–30 characters</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Username *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              placeholder="gamerpulse99"
              className="w-full pl-7 pr-8 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#534AB7]"
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium ${statusColor}`}>
              {statusIcon}
            </span>
          </div>
          {usernameStatus === 'taken' && (
            <p className="text-xs text-red-500 mt-1">
              Username taken — try {username}{Math.floor(Math.random() * 90) + 10}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Bio <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 120))}
            placeholder="Tell other gamers about yourself…"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#534AB7]"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{bio.length}/120</p>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
