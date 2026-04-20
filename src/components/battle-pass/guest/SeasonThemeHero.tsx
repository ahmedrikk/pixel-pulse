import React from 'react';
import styles from './battle-pass-guest.module.css';
import { SeasonCountdown } from '../shared/SeasonCountdown';

function formatMemberCount(count: number): string {
  if (count >= 1000) return `${Math.floor(count / 1000)}k+`;
  return count.toString();
}

export default function SeasonThemeHero({ season }: { season: any }) {
  if (!season) return null;

  const endDate = new Date(season.endDate);
  const now = new Date();
  const ms = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(ms / 86400000));
  
  const formattedEndDate = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className={styles.themeHero}>
      {/* 3 CSS Orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Act Navigation Bar */}
      <div className="relative z-10 flex justify-between items-center px-6 py-3.5 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-medium px-2.5 py-1 rounded-[10px]" style={{ background: '#534AB7', color: '#EEEDFE' }}>
            Season {season.number}
          </span>
          <div className="flex gap-1.5">
            {season.acts.map((act: any) => {
              const isActive = act.isCurrent;
              return (
                <span 
                  key={act.number}
                  className="text-[10px] px-2 py-0.5 rounded-lg border"
                  style={isActive ? {
                    color: 'var(--season-accent)',
                    borderColor: 'rgba(var(--season-accent-rgb, 252,211,77), 0.4)', // fallback if rgb not set
                    border: '0.5px solid var(--season-accent)',
                    background: 'rgba(255,255,255,0.06)'
                  } : {
                    color: 'rgba(255,255,255,0.3)',
                    border: '0.5px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Act {act.number} · {act.name}
                </span>
              );
            })}
          </div>
        </div>
        <div className="text-[11px] text-white/40">
          Ends in <SeasonCountdown endDate={endDate} />
        </div>
      </div>

      {/* Season Identity Block */}
      <div className="relative z-10 px-6 pt-7">
        <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-white/35 mb-2">
          Free Battle Pass · Season {season.number}
        </div>
        <h1 className="text-4xl font-medium leading-[1.1] mb-1 text-white">
          Season of the <span style={{ color: 'var(--season-primary)' }}>{season.shortName}</span>
        </h1>
        <p className="text-sm italic text-white/45 mb-5">
          "{season.tagline}"
        </p>
        <div className="text-[13px] text-white/55 leading-relaxed max-w-[480px] mb-6 pl-3.5" style={{ borderLeft: '2px solid var(--season-primary)' }}>
          {season.lore}
        </div>
      </div>

      {/* Season Stats Strip */}
      <div className="relative z-10 flex border-y" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex-1 p-3.5 px-5 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-xl font-medium text-white">{season.totalTiers}</div>
          <div className="text-[10px] text-white/35 tracking-wider mt-0.5">Free tiers</div>
          <div className="text-[10px] text-white/25">No purchase needed</div>
        </div>
        <div className="flex-1 p-3.5 px-5 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-xl font-medium text-white">{season.acts?.length || 5}</div>
          <div className="text-[10px] text-white/35 tracking-wider mt-0.5">Acts</div>
          <div className="text-[10px] text-white/25">New quests each act</div>
        </div>
        <div className="flex-1 p-3.5 px-5 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-xl font-medium text-white">{daysRemaining}d</div>
          <div className="text-[10px] text-white/35 tracking-wider mt-0.5">Remaining</div>
          <div className="text-[10px] text-white/25">Season ends {formattedEndDate}</div>
        </div>
        <div className="flex-1 p-3.5 px-5 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-xl font-medium text-white">+{season.signupXpBonus} XP</div>
          <div className="text-[10px] text-white/35 tracking-wider mt-0.5">Signup bonus</div>
          <div className="text-[10px] text-white/25">Instant on join</div>
        </div>
        <div className="flex-1 p-3.5 px-5">
          <div className="text-xl font-medium text-white">{formatMemberCount(season.memberCount)}</div>
          <div className="text-[10px] text-white/35 tracking-wider mt-0.5">Members earning</div>
          <div className="text-[10px] text-white/25">This season</div>
        </div>
      </div>
    </div>
  );
}
