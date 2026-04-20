import React, { useState, useEffect } from 'react';
import { type EsportsMatch } from '@/lib/pandascore';
import { useAuthGate } from '@/contexts/AuthGateContext';

interface InlinePredictionProps {
  match: EsportsMatch;
  isLive: boolean;
}

export function InlinePrediction({ match, isLive }: InlinePredictionProps) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB' | null>(null);

  // Mock community data — in prod, this comes from /api/esports/predictions?matchId=
  const communityA = 67;
  const communityB = 33;
  const totalPicks = 1840;
  const xpPill = isLive
    ? { label: '+10 XP if correct', bg: '#FEF2F2', color: '#991B1B' }
    : { label: '+45 XP if correct', bg: '#EEEDFE', color: '#3C3489' };

  function handlePredict(team: 'teamA' | 'teamB') {
    if (!isAuthenticated) {
      openAuthModal('esports_predict' as any);
      return;
    }
    setSelectedTeam(prev => prev === team ? null : team);
  }

  return (
    <div style={{ borderTop: '0.5px solid hsl(var(--border))', marginTop: 9, paddingTop: 9 }}>
      {/* Row 1 — Pick buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
          {selectedTeam ? 'Your pick:' : 'Quick pick:'}
        </span>

        {(['teamA', 'teamB'] as const).map(team => {
          const name = team === 'teamA' ? match.team1 : match.team2;
          const isSelected = selectedTeam === team;
          return (
            <button
              key={team}
              onClick={() => handlePredict(team)}
              style={{
                flex: 1,
                height: 26,
                borderRadius: 6,
                border: isSelected
                  ? '0.5px solid #534AB7'
                  : '0.5px solid hsl(var(--border))',
                background: isSelected ? '#EEEDFE' : 'hsl(var(--secondary))',
                color: isSelected ? '#534AB7' : 'hsl(var(--muted-foreground))',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                padding: '0 6px',
                maxWidth: 90,
              }}
            >
              {name}
            </button>
          );
        })}

        {/* XP Pill */}
        <span style={{
          fontSize: 10, fontWeight: 500,
          padding: '2px 7px', borderRadius: 8, flexShrink: 0,
          background: xpPill.bg, color: xpPill.color,
        }}>
          {xpPill.label}
        </span>
      </div>

      {/* Row 2 — Community bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 500, color: '#534AB7', minWidth: 24 }}>{communityA}%</span>
        <div style={{ flex: 1, height: 3, background: 'hsl(var(--border))', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${communityA}%`, background: '#534AB7' }} />
          <div style={{ flex: 1, background: 'hsl(var(--border))' }} />
        </div>
        <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', minWidth: 24, textAlign: 'right' }}>{communityB}%</span>
        <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
          · {totalPicks.toLocaleString()} picks
        </span>
      </div>

      {/* XP window warning for live matches */}
      {isLive && (
        <p style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', marginTop: 5 }}>
          ⏰ Match is live —{' '}
          <span style={{ color: '#DC2626', fontWeight: 500 }}>reduced XP window</span>.{' '}
          Pre-match picks earn <b style={{ color: '#534AB7' }}>+65 XP</b>{' '}
          · Live picks earn <b style={{ color: '#534AB7' }}>+10 XP</b>
        </p>
      )}
    </div>
  );
}
