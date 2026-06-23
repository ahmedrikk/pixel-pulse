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
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-primary/10">
            <BookOpen className="w-[14px] h-[14px] text-primary" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Read gaming news</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Every article summary you read awards XP. The more you read, the faster you climb.
          </p>
          <div className="inline-block mt-2 bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 rounded-lg border border-primary/15">
            Up to {season.xpSources.articleDailyCap} XP/day
          </div>
        </div>

        {/* Step 02: Esports */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            02
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-amber-500/10">
            <Trophy className="w-[14px] h-[14px] text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Predict esports matches</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Call winners before matches kick off. Get it right, earn bonus XP on top of your prediction XP.
          </p>
          <div className="inline-block mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-2 py-0.5 rounded-lg border border-amber-500/20">
            +{season.xpSources.predictionMin} to +{season.xpSources.predictionMax} XP/match
          </div>
        </div>

        {/* Step 03: Reviews */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            03
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-emerald-500/10">
            <MessageSquare className="w-[14px] h-[14px] text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Review games</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Rate and review games you've played. Your opinions help the community — and earn you XP.
          </p>
          <div className="inline-block mt-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded-lg border border-emerald-500/20">
            +{season.xpSources.reviewXp} XP/review
          </div>
        </div>

        {/* Step 04: Trivia */}
        <div className="bg-background border border-border/60 rounded-xl p-3.5 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <span className="absolute top-3 right-3 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
            04
          </span>
          <div className="w-[30px] h-[30px] rounded-lg mb-2.5 flex items-center justify-center bg-primary/10">
            <Brain className="w-[14px] h-[14px] text-primary" />
          </div>
          <h3 className="text-[12px] font-medium text-foreground mb-1">Daily trivia quizzes</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Gaming knowledge is power — and XP. Ace the daily quiz, earn streak bonuses, never stop learning.
          </p>
          <div className="inline-block mt-2 bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 rounded-lg border border-primary/15">
            +{season.xpSources.triviaDailyXp} XP/day
          </div>
        </div>

      </div>
    </div>
  );
}
