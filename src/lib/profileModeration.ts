import { supabase } from "@/integrations/supabase/client";

export interface ProfileModerationResult {
  isSafe: boolean;
  field: "username" | "display_name" | "about_me" | null;
  message: string | null;
}

interface ModerationRow {
  is_safe: boolean;
  field_name: string | null;
  message: string | null;
}

export async function validateProfileContent(input: {
  username?: string | null;
  displayName?: string | null;
  aboutMe?: string | null;
}): Promise<ProfileModerationResult> {
  const { data, error } = await supabase.rpc("validate_profile_content", {
    p_username: input.username ?? null,
    p_display_name: input.displayName ?? null,
    p_about_me: input.aboutMe ?? null,
  });
  if (error) throw error;
  const row = (data as ModerationRow[] | null)?.[0];
  return {
    isSafe: row?.is_safe ?? true,
    field: (row?.field_name as ProfileModerationResult["field"]) ?? null,
    message: row?.message ?? null,
  };
}

