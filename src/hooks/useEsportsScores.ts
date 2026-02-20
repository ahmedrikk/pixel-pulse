import { useQuery } from "@tanstack/react-query";
import { fetchLiveMatches, fetchUpcomingMatches, type EsportsMatch } from "@/lib/pandascore";

export function useEsportsScores() {
  const liveQuery = useQuery<EsportsMatch[]>({
    queryKey: ["esports-live"],
    queryFn: fetchLiveMatches,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  const upcomingQuery = useQuery<EsportsMatch[]>({
    queryKey: ["esports-upcoming"],
    queryFn: fetchUpcomingMatches,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: 2,
  });

  return {
    liveMatches: liveQuery.data ?? [],
    upcomingMatches: upcomingQuery.data ?? [],
    isLiveLoading: liveQuery.isLoading,
    isUpcomingLoading: upcomingQuery.isLoading,
    liveError: liveQuery.error,
    upcomingError: upcomingQuery.error,
  };
}
