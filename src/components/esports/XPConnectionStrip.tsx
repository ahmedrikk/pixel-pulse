import React from 'react';
import { Star } from 'lucide-react';

interface XPConnectionStripProps {
  isAuthenticated: boolean;
  currentTier?: number;
  currentXP?: number;
  tierXP?: number;
}

export function XPConnectionStrip({ isAuthenticated, currentTier, currentXP, tierXP }: XPConnectionStripProps) {
  const fillPct = currentXP && tierXP ? Math.min(100, Math.round((currentXP / tierXP) * 100)) : 0;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '7px 20px',
        background: '#0F2347',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left: XP pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Star style={{ width: 11, height: 11, color: '#FCD34D' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            Predictions earn XP:
          </span>
        </div>

        {/* Pre-match pill */}
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 7,
          whiteSpace: 'nowrap',
          background: 'rgba(83,74,183,0.18)',
          border: '0.5px solid rgba(83,74,183,0.35)',
          color: '#AFA9EC',
        }}>
          Before match: +20 XP predict / +45 if correct
        </span>

        {/* Live pill */}
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 7,
          whiteSpace: 'nowrap',
          background: 'rgba(220,38,38,0.12)',
          border: '0.5px solid rgba(220,38,38,0.25)',
          color: '#FCA5A5',
        }}>
          During match: +5 XP predict / +10 if correct
        </span>

        {/* Streak pill */}
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 7,
          whiteSpace: 'nowrap',
          background: 'rgba(251,191,36,0.12)',
          border: '0.5px solid rgba(251,191,36,0.3)',
          color: '#FCD34D',
        }}>
          7-day streak: 2× all XP
        </span>
      </div>

      {/* Right: mini Battle Pass bar (auth only, hidden on mobile) */}
      {isAuthenticated && currentTier !== undefined && (
        <div
          className="bp-mini"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            Tier {currentTier}
          </span>
          <div style={{ width: 72, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${fillPct}%`, background: '#534AB7', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            {currentXP}/{tierXP} XP
          </span>
        </div>
      )}
    </div>
  );
}
