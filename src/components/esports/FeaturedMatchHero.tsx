import React, { useState } from 'react';
import { type EsportsMatch } from '@/lib/pandascore';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { WatchLiveButton } from '@/components/esports/WatchLiveButton';

interface FeaturedMatchHeroProps {
  match: EsportsMatch | null;
}

function TeamTile({ image, name }: { image?: string | null; name?: string }) {
  return (
    <div className="w-[58px] h-[58px] rounded-xl border bg-secondary flex items-center justify-center text-lg font-bold text-foreground overflow-hidden">
      {image
        ? <img src={image} alt={name} className="w-full h-full object-contain" />
        : (name?.[0] ?? 'T')}
    </div>
  );
}

export function FeaturedMatchHero({ match }: FeaturedMatchHeroProps) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB' | null>(null);

  if (!match) return null;

  const isLive = match.status === 'running';

  function handlePredict(team: 'teamA' | 'teamB') {
    if (!isAuthenticated) {
      openAuthModal('esports_predict');
      return;
    }
    setSelectedTeam(prev => prev === team ? null : team);
  }

  const xpCards = [
    { label: 'Pre-match', val: '+20 XP', desc: '+45 if correct', cls: 'bg-primary/10 border-primary/20 text-primary' },
    { label: 'Live', val: '+5 XP', desc: '+10 if correct', cls: 'bg-destructive/10 border-destructive/20 text-destructive' },
    { label: 'Streak', val: '2× XP', desc: '7-day login streak', cls: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="mb-6">
      <div className="mx-auto bg-card border rounded-2xl card-shadow p-5 md:p-6">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-4">
          {isLive && (
            <span className="bg-destructive text-destructive-foreground text-[9px] font-semibold px-2 py-0.5 rounded-md">
              ● LIVE
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            Match of the day · {match.league} · {match.numberOfGames ? `Bo${match.numberOfGames}` : 'Match'}
          </span>
          {isLive && match.streamUrl && (
            <div className="ml-auto">
              <WatchLiveButton streamUrl={match.streamUrl} matchId={match.id} />
            </div>
          )}
        </div>

        {/* Match Display */}
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <TeamTile image={match.team1Image} name={match.team1} />
            <span title={match.team1} className="text-sm font-medium text-foreground text-center truncate max-w-full">{match.team1}</span>
            <span className="text-[10px] text-muted-foreground">Team A</span>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 text-center">
            <div className="text-4xl font-semibold text-foreground tracking-widest tabular-nums">
              {match.score1} : {match.score2}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {isLive ? 'Live' : 'Upcoming'}
            </div>
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <TeamTile image={match.team2Image} name={match.team2} />
            <span title={match.team2} className="text-sm font-medium text-foreground text-center truncate max-w-full">{match.team2}</span>
            <span className="text-[10px] text-muted-foreground">Team B</span>
          </div>
        </div>

        {/* XP Tier Cards */}
        <div className="flex gap-2 mt-5">
          {xpCards.map(card => (
            <div key={card.label} className={`flex-1 rounded-lg border px-2.5 py-2 text-center ${card.cls}`}>
              <div className="text-[9px] font-semibold opacity-80">{card.label}</div>
              <div className="text-[15px] font-semibold text-foreground">{card.val}</div>
              <div className="text-[9px] text-muted-foreground">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* Prediction Widget */}
        <div className="bg-secondary/60 border rounded-xl mt-3 px-3.5 py-3">
          <p className="text-[11px] text-muted-foreground text-center mb-2">
            Who wins the series? Predict before it starts for maximum XP
          </p>

          {/* Pick buttons */}
          <div className="flex gap-2 mb-2">
            {(['teamA', 'teamB'] as const).map(team => {
              const name = team === 'teamA' ? match.team1 : match.team2;
              const isSelected = selectedTeam === team;
              return (
                <button
                  key={team}
                  onClick={() => handlePredict(team)}
                  className={`flex-1 h-9 rounded-lg border text-[11px] font-medium truncate px-2 transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Pre-match: <b className="text-amber-600 dark:text-amber-400">+65 XP</b> if correct ·{' '}
            Live: <b className="text-amber-600 dark:text-amber-400">+10 XP</b>
          </p>
        </div>
      </div>
    </div>
  );
}
