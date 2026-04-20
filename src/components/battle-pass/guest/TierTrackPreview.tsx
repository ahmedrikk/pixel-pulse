import React from 'react';
import styles from './battle-pass-guest.module.css';

export default function TierTrackPreview({ season }: { season: any }) {
  if (!season) return null;

  const tiers = season.tierTrackPreview || [];

  return (
    <div className="bg-background px-6 py-7">
      <h2 className="text-base font-medium text-foreground mb-1">
        The {season.shortName} tier track — first 8 tiers
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Rewards start at Tier 1. No warm-up period. No paid gate.
      </p>

      {/* Track Container */}
      <div className="flex gap-[7px] overflow-hidden py-1">
        {tiers.map((node: any, i: number) => {
          const isMilestone = node.isMilestone;
          const isLocked = i >= 5; // Tiers 6-8 (index 5-7) are opacity: 0.4

          return (
            <div 
              key={i}
              className="w-[60px] flex-shrink-0 flex flex-col items-center gap-[5px] rounded-[10px] bg-background"
              style={{
                padding: '8px 4px',
                border: isMilestone ? '1px solid var(--season-primary)' : '0.5px solid hsl(var(--border)/0.5)',
                opacity: isLocked ? 0.4 : 1,
              }}
            >
              <div className="text-[9px] font-medium text-muted-foreground">
                {node.tier}
              </div>
              
              <div 
                className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-lg"
                style={{ background: node.iconBg || 'hsl(var(--secondary))' }}
              >
                {node.icon}
              </div>
              
              <div className="text-[9px] text-muted-foreground">
                {node.xpRequired / 1000}K XP
              </div>
              
              {isMilestone && node.milestoneLabel && (
                <div 
                  className="text-[8px] font-medium mt-auto"
                  style={{ color: 'var(--season-primary)' }}
                >
                  {node.milestoneLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar Below */}
      <div className={styles.trackProgress}>
        <div className={styles.tpFill} />
      </div>
      
      <p className="text-[11px] text-muted-foreground/70 text-center mt-2">
        Sign up to start tracking your progress across all {season.totalTiers} tiers
      </p>
    </div>
  );
}
