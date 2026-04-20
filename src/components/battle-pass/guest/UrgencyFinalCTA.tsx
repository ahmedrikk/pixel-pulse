import React from 'react';
import styles from './battle-pass-guest.module.css';
import { useAuthGate } from '@/contexts/AuthGateContext';

export default function UrgencyFinalCTA({ season }: { season: any }) {
  const { openAuthModal } = useAuthGate();

  if (!season) return null;

  const endDate = new Date(season.endDate);
  const startDate = new Date(season.startDate);
  const now = new Date();
  
  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
  
  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / 86400000));

  return (
    <div style={{ background: '#0A1628', padding: '32px 24px' }}>
      <div style={{ maxWidth: '580px', margin: '0 auto', textAlign: 'center' }}>
        
        {/* Season Status Chip */}
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1 mb-3.5 rounded-[10px]"
          style={{
            background: 'color-mix(in srgb, var(--season-primary) 10%, transparent)',
            border: '0.5px solid color-mix(in srgb, var(--season-primary) 30%, transparent)',
            color: 'var(--season-primary)',
            fontSize: '11px',
            fontWeight: 500
          }}
        >
          <div className="w-[5px] h-[5px] rounded-full bg-[#10b981]" />
          Season {season.number} is live now
        </div>

        {/* Urgency Title & Subtitle */}
        <h2 className="text-[22px] font-medium leading-[1.2] text-white mb-1.5">
          The {season.shortName} burns for {daysRemaining} more days.<br/>
          Don't watch from the sidelines.
        </h2>
        
        <p className="text-[13px] text-white/40 mb-5">
          Every day you wait is XP left on the table. Tier 1 reward unlocks in minutes.
        </p>

        {/* Season Progress Bar */}
        <div className={styles.urgBarBg}>
          <div 
            className={styles.urgBarFill} 
            style={{ width: `${percentElapsed}%` }} 
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/25 mb-[22px]">
          <span>Season start</span>
          <span>▶ Now — {percentElapsed}% elapsed</span>
          <span>Season end</span>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-2">
          <button 
            type="button"
            onClick={() => openAuthModal('battlepass' as any)}
            className="hover:shadow-lg hover:-translate-y-0.5 transition-all w-full sm:w-auto"
            style={{
              background: '#534AB7',
              color: '#fff',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Join free — start earning tonight →
          </button>
          
          <button 
            type="button"
            onClick={() => openAuthModal('battlepass_login' as any)}
            className="hover:bg-white/5 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.55)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              padding: '12px 20px',
              borderRadius: '9px',
              fontSize: '13px'
            }}
          >
            Log in to existing account
          </button>
        </div>

        {/* Fine print */}
        <p className="text-[11px] text-white/20 mt-3">
          Free forever · No credit card · +{season.signupXpBonus} XP the moment you sign up
        </p>
      </div>
    </div>
  );
}
