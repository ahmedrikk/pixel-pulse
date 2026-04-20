import React from 'react';

function getTierPillStyle(tier: number, isFeatured: boolean) {
  if (isFeatured) return { background: '#534AB7', color: '#FFFFFF' };
  if (tier <= 3) return { background: '#EEEDFE', color: '#3C3489' };
  if (tier <= 6) return { background: '#FAEEDA', color: '#633806' };
  if (tier <= 12) return { background: '#EFF6FF', color: '#0C447C' };
  if (tier <= 20) return { background: '#FAEEDA', color: '#633806' };
  return { background: '#534AB7', color: '#FFFFFF' };
}

export default function FeaturedSeasonRewards({ season }: { season: any }) {
  if (!season) return null;

  const rewards = season.promoRewards || [];
  const remainingCount = Math.max(0, season.totalRewardCount - rewards.length);

  return (
    <div className="bg-secondary/20 px-6 py-7">
      <h2 className="text-base font-medium text-foreground mb-1">
        Season {season.number} rewards — all free
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        {season.shortName}-themed rewards you can only earn this season. Miss the window, miss them forever.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {rewards.map((reward: any, i: number) => {
          const tierStyle = getTierPillStyle(reward.tier, reward.isFeatured);
          
          return (
            <div 
              key={i} 
              className="bg-background rounded-xl p-3.5 flex flex-col items-center text-center gap-1.5 transition-colors group cursor-default"
              style={{
                border: reward.isFeatured ? '0.5px solid #534AB7' : '0.5px solid hsl(var(--border)/0.5)'
              }}
            >
              <div 
                className="w-11 h-11 rounded-[11px] flex items-center justify-center text-2xl mb-1 shadow-sm group-hover:scale-105 transition-transform"
                style={{ background: reward.iconBg || '#EEEDFE' }}
              >
                {reward.icon}
              </div>
              
              {reward.isFounderReward && (
                <span className="text-[9px] font-medium text-[#16A34A] bg-[#EAF3DE] px-1.5 py-[1px] rounded-[6px]">
                  Founder
                </span>
              )}
              
              <div className="text-[12px] font-medium leading-[1.3] text-foreground mt-0.5">
                {reward.name}
              </div>
              
              <div className="text-[10px] text-muted-foreground">
                {reward.type}
              </div>
              
              <div 
                className="text-[10px] font-medium px-2 py-0.5 rounded-[9px] mt-1"
                style={tierStyle}
              >
                Tier {reward.tier}
              </div>
            </div>
          );
        })}

        {/* Locked Placeholder Card */}
        <div 
          className="bg-background rounded-xl p-3.5 flex flex-col items-center justify-center text-center gap-1.5 opacity-60"
          style={{ border: '0.5px solid hsl(var(--border)/0.5)' }}
        >
          <div 
            className="w-11 h-11 rounded-[11px] flex items-center justify-center text-2xl mb-1 grayscale bg-border/50"
          >
            👑
          </div>
          
          <div className="text-[12px] font-medium leading-[1.3] text-muted-foreground mt-1.5">
            + {remainingCount} more rewards
          </div>
          
          <div className="text-[10px] text-muted-foreground">
            Tiers 16 – 25
          </div>
          
          <div className="text-[10px] font-medium px-2 py-0.5 rounded-[9px] mt-1 bg-border/50 text-muted-foreground">
            Sign up to reveal
          </div>
        </div>
      </div>
    </div>
  );
}
