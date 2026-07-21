import React, { useState } from 'react';
import { type EsportsMatch } from '@/lib/pandascore';
import { useAuthGate } from '@/contexts/AuthGateContext';

interface InlinePredictionProps {
  match: EsportsMatch;
}

export function InlinePrediction({ match }: InlinePredictionProps) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB' | null>(null);

  function handlePredict(team: 'teamA' | 'teamB') {
    if (!isAuthenticated) {
      openAuthModal('esports_predict');
      return;
    }
    setSelectedTeam(prev => prev === team ? null : team);
  }

  return (
    <div className="border-t border-border mt-2.5 pt-2.5">
      {/* Pick buttons */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {selectedTeam ? 'Your pick:' : 'Quick pick:'}
        </span>

        {(['teamA', 'teamB'] as const).map(team => {
          const name = team === 'teamA' ? match.team1 : match.team2;
          const isSelected = selectedTeam === team;
          return (
            <button
              key={team}
              onClick={() => handlePredict(team)}
              className={`flex-1 h-[26px] max-w-[90px] rounded-md border text-[10px] font-medium truncate px-1.5 transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {name}
            </button>
          );
        })}

      </div>
    </div>
  );
}
