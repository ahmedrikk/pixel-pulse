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
    <div className="flex justify-between items-center flex-wrap gap-2 px-5 py-2 bg-secondary/50 border-b border-border">
      {/* Left: XP pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Star className="w-[11px] h-[11px] text-amber-500" />
          <span className="text-[10px] font-medium text-muted-foreground">
            Predictions earn XP:
          </span>
        </div>

        {/* Pre-match pill */}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap bg-primary/10 border border-primary/25 text-primary">
          Before match: +20 XP predict / +45 if correct
        </span>

        {/* Live pill */}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap bg-destructive/10 border border-destructive/25 text-destructive">
          During match: +5 XP predict / +10 if correct
        </span>

        {/* Streak pill */}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
          7-day streak: 2× all XP
        </span>
      </div>

      {/* Right: mini Battle Pass bar (auth only, hidden on mobile) */}
      {isAuthenticated && currentTier !== undefined && (
        <div className="bp-mini flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            Tier {currentTier}
          </span>
          <div className="w-[72px] h-[3px] rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${fillPct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {currentXP}/{tierXP} XP
          </span>
        </div>
      )}
    </div>
  );
}
