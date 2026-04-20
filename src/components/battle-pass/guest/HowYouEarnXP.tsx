import React from 'react';
import { BookOpen, Trophy, MessageSquare, Brain } from 'lucide-react';

export default function HowYouEarnXP({ season }: { season: any }) {
  if (!season) return null;

  return (
    <div className="bg-background px-6 py-7">
      <h2 className="text-base font-medium text-foreground mb-1">
        How you earn XP in {season.shortName}
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Four ways to climb the tier track — pick what fits your playstyle
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        
        {/* Step 01: News */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            01
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-[#EEEDFE]">
            <BookOpen className="w-[14px] h-[14px] text-[#3C3489]" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Read gaming news</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Every article summary you read awards XP. The more you read, the faster you climb.
          </p>
          <div className="inline-block mt-2 bg-[#EEEDFE] text-[#3C3489] text-[10px] font-medium px-2 py-0.5 rounded-lg border border-[#3C3489]/10">
            Up to {season.xpSources.articleDailyCap} XP/day
          </div>
        </div>

        {/* Step 02: Esports */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            02
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-[#FAEEDA]">
            <Trophy className="w-[14px] h-[14px] text-[#633806]" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Predict esports matches</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Call winners before matches kick off. Get it right, earn bonus XP on top of your prediction XP.
          </p>
          <div className="inline-block mt-2 bg-[#FAEEDA] text-[#633806] text-[10px] font-medium px-2 py-0.5 rounded-lg border border-[#633806]/10">
            +{season.xpSources.predictionMin} to +{season.xpSources.predictionMax} XP/match
          </div>
        </div>

        {/* Step 03: Reviews */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            03
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-[#E1F5EE]">
            <MessageSquare className="w-[14px] h-[14px] text-[#065F46]" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Review games</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Rate and review games you've played. Your opinions help the community — and earn you XP.
          </p>
          <div className="inline-block mt-2 bg-[#E1F5EE] text-[#065F46] text-[10px] font-medium px-2 py-0.5 rounded-lg border border-[#065F46]/10">
            +{season.xpSources.reviewXp} XP/review
          </div>
        </div>

        {/* Step 04: Trivia */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            04
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-[#EEEDFE]">
            <Brain className="w-[14px] h-[14px] text-[#3C3489]" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Daily trivia quizzes</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Gaming knowledge is power — and XP. Ace the daily quiz, earn streak bonuses, never stop learning.
          </p>
          <div className="inline-block mt-2 bg-[#EEEDFE] text-[#3C3489] text-[10px] font-medium px-2 py-0.5 rounded-lg border border-[#3C3489]/10">
            +{season.xpSources.triviaDailyXp} XP/day
          </div>
        </div>

      </div>
    </div>
  );
}
