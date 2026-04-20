import React, { useState } from 'react';
import { type EsportsMatch } from '@/lib/pandascore';
import { useAuthGate } from '@/contexts/AuthGateContext';

interface FeaturedMatchHeroProps {
  match: EsportsMatch | null;
}

const GAME_INIT_COLORS: Record<string, { bg: string; text: string; initials: string }> = {
  valorant:  { bg: '#1a0a0a', text: '#D85A30', initials: 'VL' },
  cs2:       { bg: '#1a1a2e', text: '#7F77DD', initials: 'CS' },
  dota2:     { bg: '#1a0000', text: '#ef4444', initials: 'D2' },
  lol:       { bg: '#0a0a1a', text: '#C8A84B', initials: 'LoL' },
};

export function FeaturedMatchHero({ match }: FeaturedMatchHeroProps) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB' | null>(null);

  if (!match) return null;

  const isLive = match.status === 'running';
  const gameKey = match.gameSlug?.toLowerCase().replace(/-/g, '') || 'valorant';
  const gameColors = GAME_INIT_COLORS[gameKey] || GAME_INIT_COLORS['valorant'];

  // Mock community predictions
  const communityA = 62;
  const communityB = 38;
  const communityTotal = 3241;

  function handlePredict(team: 'teamA' | 'teamB') {
    if (!isAuthenticated) {
      openAuthModal('esports_predict' as any);
      return;
    }
    setSelectedTeam(prev => prev === team ? null : team);
  }

  return (
    <div style={{ background: '#0A1628', position: 'relative', overflow: 'hidden' }}>
      {/* CSS Orbs */}
      <div style={{ width: 320, height: 320, background: '#534AB7', opacity: 0.10, top: -100, right: 80, borderRadius: '50%', position: 'absolute', pointerEvents: 'none' }} />
      <div style={{ width: 220, height: 220, background: '#EA580C', opacity: 0.08, top: 10, right: 0, borderRadius: '50%', position: 'absolute', pointerEvents: 'none' }} />
      <div style={{ width: 180, height: 180, background: '#F59E0B', opacity: 0.06, bottom: -60, right: 140, borderRadius: '50%', position: 'absolute', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px 0' }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {isLive && (
            <span style={{ background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 6 }}>
              ● LIVE
            </span>
          )}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            Match of the day · {match.league} · {match.numberOfGames ? `Bo${match.numberOfGames}` : 'Match'}
          </span>
        </div>

        {/* Match Display */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {/* Team A */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: gameColors.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: gameColors.text,
            }}>
              {match.team1Image
                ? <img src={match.team1Image} alt={match.team1} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} />
                : (match.team1?.[0] ?? 'T')}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#fff', textAlign: 'center', maxWidth: 100 }}>{match.team1}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Team A</span>
          </div>

          {/* Score */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 500, color: '#fff', letterSpacing: 3 }}>
              {match.score1} : {match.score2}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              {isLive ? 'Live' : 'Upcoming'}
            </div>
          </div>

          {/* Team B */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: gameColors.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: gameColors.text,
            }}>
              {match.team2Image
                ? <img src={match.team2Image} alt={match.team2} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} />
                : (match.team2?.[0] ?? 'T')}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#fff', textAlign: 'center', maxWidth: 100 }}>{match.team2}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Team B</span>
          </div>
        </div>

        {/* XP Tier Cards */}
        <div style={{ display: 'flex', gap: 6, margin: '14px 0 0' }}>
          {[
            { bg: 'rgba(83,74,183,0.18)', border: '0.5px solid rgba(83,74,183,0.3)', labelColor: '#AFA9EC', val: '+20 XP', desc: '+45 if correct', label: 'Pre-match' },
            { bg: 'rgba(220,38,38,0.1)', border: '0.5px solid rgba(220,38,38,0.2)', labelColor: '#FCA5A5', val: '+5 XP', desc: '+10 if correct', label: 'Live' },
            { bg: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.2)', labelColor: '#FCD34D', val: '2× XP', desc: '7-day login streak', label: 'Streak' },
          ].map(card => (
            <div key={card.label} style={{ flex: 1, background: card.bg, border: card.border, borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: card.labelColor }}>{card.label}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{card.val}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{card.desc}</div>
            </div>
          ))}
        </div>

        {/* Prediction Widget */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          margin: '12px 0 18px',
          padding: '12px 14px',
        }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 8 }}>
            Who wins the series? Predict before it starts for maximum XP
          </p>

          {/* Pick buttons */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
            {(['teamA', 'teamB'] as const).map(team => {
              const name = team === 'teamA' ? match.team1 : match.team2;
              const isSelected = selectedTeam === team;
              return (
                <button
                  key={team}
                  onClick={() => handlePredict(team)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    border: isSelected ? '0.5px solid #534AB7' : '0.5px solid rgba(255,255,255,0.15)',
                    background: isSelected ? '#534AB7' : 'rgba(255,255,255,0.06)',
                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Community bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#7F77DD', minWidth: 26 }}>{communityA}%</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${communityA}%`, background: '#534AB7', borderRadius: '2px 0 0 2px' }} />
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', minWidth: 26, textAlign: 'right' }}>{communityB}%</span>
          </div>

          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 7 }}>
            {communityTotal.toLocaleString()} community predictions ·{' '}
            Pre-match: <b style={{ color: '#FCD34D' }}>+65 XP</b> if correct ·{' '}
            Live: <b style={{ color: '#FCD34D' }}>+10 XP</b>
          </p>
        </div>
      </div>
    </div>
  );
}
