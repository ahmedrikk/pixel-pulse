import { useRef, useState } from 'react';
import { Camera, Grid2x2, Type } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { uploadAvatar } from '@/lib/onboardingService';

const PRESET_SEEDS = [
  'knight','mage','sniper','racer','ninja','wizard','ranger','rogue',
  'paladin','berserker','archer','bard','druid','monk','warlock','samurai',
  'pirate','viking','assassin','guardian','mercenary','hunter','scout','shaman',
];

const INITIALS_COLORS = [
  '#534AB7','#3C3489','#e4000f','#107C10',
  '#FF6900','#00B4D8','#1b2838','#9333ea',
];

function getInitialsColor(username: string): string {
  return INITIALS_COLORS[username.charCodeAt(0) % INITIALS_COLORS.length];
}

export type AvatarValue =
  | { type: 'initials'; initials: string; color: string; url: null }
  | { type: 'preset';   initials: string; color: string; url: string; seed: string }
  | { type: 'upload';   initials: string; color: string; url: string };

interface AvatarPickerProps {
  username: string;
  userId: string;
  value: AvatarValue;
  onChange: (v: AvatarValue) => void;
}

export function AvatarPicker({ username, userId, value, onChange }: AvatarPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = username.slice(0, 2).toUpperCase() || 'GP';
  const color = getInitialsColor(username || 'a');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, file);
      onChange({ type: 'upload', initials, color, url });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function selectPreset(seed: string) {
    const url = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`;
    onChange({ type: 'preset', initials, color, url, seed });
    setPickerOpen(false);
  }

  function useInitials() {
    onChange({ type: 'initials', initials, color, url: null });
  }

  const preview = value.type === 'initials'
    ? <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl"
           style={{ background: value.color }}>{value.initials || 'GP'}</div>
    : <img src={value.url!} alt="avatar" className="w-full h-full rounded-full object-cover" />;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-20 h-20 rounded-full ring-2 ring-[#534AB7] overflow-hidden bg-gray-100">
        {preview}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:border-[#534AB7] transition-colors"
        >
          <Camera className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:border-[#534AB7] transition-colors"
        >
          <Grid2x2 className="w-3.5 h-3.5" /> Choose avatar
        </button>

        <button
          type="button"
          onClick={useInitials}
          className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${
            value.type === 'initials' ? 'border-[#534AB7] bg-purple-50 text-[#534AB7]' : 'border-gray-200 hover:border-[#534AB7]'
          }`}
        >
          <Type className="w-3.5 h-3.5" /> Initials
        </button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Choose your avatar</DialogTitle>
          <div className="grid grid-cols-6 gap-3 mt-2">
            {PRESET_SEEDS.map(seed => (
              <button
                key={seed}
                type="button"
                onClick={() => selectPreset(seed)}
                title={seed}
                className={`w-12 h-12 rounded-full overflow-hidden ring-2 transition-all ${
                  value.type === 'preset' && (value as { seed?: string }).seed === seed
                    ? 'ring-[#534AB7]' : 'ring-transparent hover:ring-purple-300'
                }`}
              >
                <img
                  src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`}
                  alt={seed}
                  className="w-full h-full"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
