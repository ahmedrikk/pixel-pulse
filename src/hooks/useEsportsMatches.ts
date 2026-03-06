import { useQuery } from "@tanstack/react-query";
import {
  fetchLiveMatches,
  fetchUpcomingMatches,
  fetchPastMatches,
  type EsportsMatch,
} from "@/lib/pandascore";

export function useEsportsMatches() {
  const live = useQuery({
    queryKey: ["esports", "live"],
    queryFn: fetchLiveMatches,
    refetchInterval: 30_000, // refresh every 30s for live matches
  });

  const upcoming = useQuery({
    queryKey: ["esports", "upcoming"],
    queryFn: fetchUpcomingMatches,
    refetchInterval: 60_000,
  });

  const past = useQuery({
    queryKey: ["esports", "past"],
    queryFn: fetchPastMatches,
    refetchInterval: 120_000,
  });

  const isLoading = live.isLoading || upcoming.isLoading || past.isLoading;
  const error = live.error || upcoming.error || past.error;

  return {
    liveMatches: live.data ?? [],
    upcomingMatches: upcoming.data ?? [],
    pastMatches: past.data ?? [],
    isLoading,
    error,
  };
}
