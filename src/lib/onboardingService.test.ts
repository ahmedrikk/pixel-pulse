import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { checkUsernameAvailable, saveStep1, saveStep2, saveStep3 } from './onboardingService';
import { supabase } from '@/integrations/supabase/client';

describe('checkUsernameAvailable', () => {
  it('returns true when username not found', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });
    const result = await checkUsernameAvailable('newuser');
    expect(result).toBe(true);
  });

  it('returns false when username exists', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'abc' }, error: null }),
        }),
      }),
    });
    const result = await checkUsernameAvailable('takenuser');
    expect(result).toBe(false);
  });
});

describe('saveStep1', () => {
  it('upserts identity fields to profiles', async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: updateMock }),
    });

    await saveStep1('user-1', {
      displayName: 'GamerX',
      username: 'gamerx',
      avatarUrl: null,
      avatarType: 'initials',
      avatarInitials: 'GX',
      avatarColor: '#534AB7',
      bio: '',
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });
});
