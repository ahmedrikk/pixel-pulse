import React from 'react';
import { useAuthGate } from '@/contexts/AuthGateContext';

export default function MidPageCTAStrip({ season }: { season: any }) {
  const { openAuthModal } = useAuthGate();

  if (!season) return null;

  const endDate = new Date(season.endDate);
  const now = new Date();
  const ms = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(ms / 86400000));

  return (
    <div style={{
      background: '#0F2347',
      padding: '20px 24px',
      borderTop: '0.5px solid rgba(255,255,255,0.06)',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Left side */}
      <div>
        <h2 className="text-[14px] font-medium text-white mb-0.5">
          Ready to start your Season {season.number} journey?
        </h2>
        <p className="text-[11px] text-white/35">
          +{season.signupXpBonus} XP the moment you sign up · {season.shortName} · {daysRemaining} days left
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <span style={{
          fontSize: '10px',
          color: '#6EE7B7',
          background: 'rgba(16,185,129,0.12)',
          border: '0.5px solid rgba(16,185,129,0.25)',
          borderRadius: '8px',
          padding: '2px 8px'
        }}>
          Free
        </span>

        <button 
          type="button"
          onClick={() => openAuthModal('battlepass_login' as any)}
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontWeight: 500
          }}
          className="hover:scale-105 hover:bg-white/10 transition-all"
        >
          Log in
        </button>

        <button 
          type="button"
          onClick={() => openAuthModal('battlepass' as any)}
          style={{
            fontSize: '11px',
            color: '#fff',
            background: 'var(--season-primary)',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            fontWeight: 500
          }}
          className="hover:scale-105 hover:brightness-110 transition-all"
        >
          Join free →
        </button>
      </div>
    </div>
  );
}
