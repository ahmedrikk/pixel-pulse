import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  xp: number;
  level: number;
  avatarUrl: string | null;
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, xp, level, avatar_url")
    .order("xp", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    username: row.username ?? "Anonymous",
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    avatarUrl: row.avatar_url ?? null,
  }));
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    staleTime: 5 * 60 * 1000, // refresh every 5 min
  });
}
