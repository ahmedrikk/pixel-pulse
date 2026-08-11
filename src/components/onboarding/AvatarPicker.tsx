import { useRef, useState } from 'react';
import { Camera, Grid2x2, Type } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadAvatar } from '@/lib/onboardingService';
import { PROFILE_AVATARS } from '@/lib/profileAssets';

const INITIALS_COLORS = [
  '#3d59e0','#3d59e0','#e4000f','#107C10',
  '#FF6900','#00B4D8','#1b2838','#3d59e0',
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

  function selectPreset(id: string, url: string) {
    onChange({ type: 'preset', initials, color, url, seed: id });
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
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-20 h-20 rounded-full ring-2 ring-[#3d59e0] overflow-hidden bg-gray-100">
        {preview}
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 text-tiny-label transition-colors hover:border-[#3d59e0] sm:min-h-10 sm:px-3 sm:text-xs"
        >
          <Camera className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 text-tiny-label transition-colors hover:border-[#3d59e0] sm:min-h-10 sm:px-3 sm:text-xs"
        >
          <Grid2x2 className="w-3.5 h-3.5" /> Choose avatar
        </button>

        <button
          type="button"
          onClick={useInitials}
          className={`col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-tiny-label transition-colors sm:col-auto sm:min-h-10 sm:text-xs ${
            value.type === 'initials' ? 'border-[#3d59e0] bg-blue-50 text-[#3d59e0]' : 'border-gray-200 hover:border-[#3d59e0]'
          }`}
        >
          <Type className="w-3.5 h-3.5" /> Initials
        </button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Avatar</DialogTitle>
            <DialogDescription>Equip a Talus image or upload your own.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROFILE_AVATARS.map(asset => (
              <button
                key={asset.id}
                type="button"
                onClick={() => selectPreset(asset.id, asset.url)}
                className={`overflow-hidden rounded-xl border bg-secondary text-left transition-all ${
                  value.type === 'preset' && (value as { seed?: string }).seed === asset.id
                    ? 'border-[#3d59e0] ring-2 ring-[#3d59e0]/20' : 'hover:border-[#3d59e0]'
                }`}
              >
                <img
                  src={asset.url}
                  alt={asset.label}
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-2 py-2 text-xs font-semibold">{asset.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            <Camera className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload your own'}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
