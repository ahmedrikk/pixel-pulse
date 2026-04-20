import React, { useEffect, useState } from 'react';
import { getCurrentSeason } from '@/lib/api';
import SeasonThemeHero from './SeasonThemeHero';
import WhyJoinSection from './WhyJoinSection';
import MidPageCTAStrip from './MidPageCTAStrip';
import HowYouEarnXP from './HowYouEarnXP';
import FeaturedSeasonRewards from './FeaturedSeasonRewards';
import TierTrackPreview from './TierTrackPreview';
import UrgencyFinalCTA from './UrgencyFinalCTA';

export default function BattlePassGuestPage() {
  const [season, setSeason] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSeason() {
      try {
        const data = await getCurrentSeason();
        setSeason(data);
      } catch (e) {
        console.error('Failed to load season data', e);
      } finally {
        setLoading(false);
      }
    }
    fetchSeason();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!season) {
    return <div className="flex items-center justify-center min-h-screen">Season data unavailable.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeasonThemeHero season={season} />
      <WhyJoinSection season={season} />
      <MidPageCTAStrip season={season} />
      <HowYouEarnXP season={season} />
      <FeaturedSeasonRewards season={season} />
      <TierTrackPreview season={season} />
      <UrgencyFinalCTA season={season} />
    </div>
  );
}
