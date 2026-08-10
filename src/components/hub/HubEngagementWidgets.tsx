import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, Clock3, Radio, RotateCcw, Share2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useHigherLower, useHigherLowerLeaderboard, useSentiment, useTodayInGamingHistory, type HLRound, type SentimentQuestion } from "@/hooks/useHubEngagement";
import { GameArtwork } from "@/components/shared/GameArtwork";

function SectionHeader({ icon, title, context, action }: { icon: React.ReactNode; title: string; context: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-gradient-to-r from-accent/10 to-transparent px-4 py-3.5 sm:px-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{context}</span>
      {action && <div className="ml-auto text-xs font-semibold text-primary">{action}</div>}
    </div>
  );
}

function formatValue(category: string, value: number | null) {
  if (value == null) return "?";
  if (category === "release_year") return String(value);
  if (category === "metacritic_user_score") return value.toFixed(1);
  if (category === "esports_prize_pool") return `$${value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value.toLocaleString()}`;
  if (category === "steam_player_count") return value.toLocaleString();
  if (category === "twitch_hours_watched") return `${(value / 1_000_000).toFixed(0)}M hours`;
  return String(value);
}

function Comparison({ round, revealedValue }: { round: HLRound; revealedValue?: number | null }) {
  const cards = [
    { ...round.itemA, active: false },
    { ...round.itemB, value: revealedValue ?? round.itemB.value, active: true },
  ];
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 p-4 sm:gap-4 sm:p-5">
      {cards.map((item, index) => (
        <div key={`${item.name}-${index}`} className="contents">
          {index === 1 && <div className="flex items-center text-[10px] font-black text-muted-foreground">VS</div>}
          <div className={`min-w-0 rounded-xl border p-3 text-center transition-colors sm:p-4 ${item.active ? "border-[1.5px] border-primary bg-primary/10" : "border-border bg-card"}`}>
            <GameArtwork name={item.name} className="mx-auto mb-2 h-14 w-14 rounded-xl" />
            <p className="truncate text-xs font-bold text-foreground sm:text-sm">{item.name}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{round.categoryLabel}</p>
            <p className={`mt-1 text-base font-black ${item.active ? "text-primary" : "text-foreground"}`}>{formatValue(round.category, item.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HigherLowerSection() {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { round, isLoading, error, guess, isGuessing, refetch } = useHigherLower();
  const [result, setResult] = useState<{ correct: boolean; actualValue: number } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { data: leaders = [], isLoading: leaderboardLoading } = useHigherLowerLeaderboard(showLeaderboard);
  const choose = async (choice: "higher" | "lower") => {
    if (!isAuthenticated) return openAuthModal("higher_lower_guess" as never);
    if (!round || result) return;
    const next = await guess({ roundId: round.id, guess: choice });
    setResult({ correct: next.correct, actualValue: next.actualValue });
    if (next.correct) window.setTimeout(async () => { setResult(null); await refetch(); }, 950);
  };
  const restart = async () => { setResult(null); await refetch(); };
  return (
    <section className="border-b border-border bg-card" aria-labelledby="higher-lower-title">
      <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Higher or Lower" context={<><Users className="mr-1 inline h-3 w-3" />{round?.totalGuesses.toLocaleString() ?? "—"} today</>} action={<button type="button" onClick={() => setShowLeaderboard((open) => !open)} className="inline-flex items-center gap-1 hover:underline" aria-expanded={showLeaderboard}>Leaderboard <Trophy className="h-3 w-3" /> →</button>} />
      {showLeaderboard && (
        <div className="border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
          {leaderboardLoading ? <p className="text-xs text-muted-foreground">Loading the top runs…</p> : leaders.length ? (
            <ol className="grid gap-2 sm:grid-cols-2">
              {leaders.slice(0, 10).map((leader, index) => <li key={leader.userId} className="flex items-center rounded-lg border border-border bg-card px-3 py-2 text-xs"><b className="mr-2 text-primary">#{index + 1}</b><span className="truncate font-semibold text-foreground">{leader.username}</span><span className="ml-auto text-muted-foreground">{leader.bestRun} correct</span></li>)}
            </ol>
          ) : <p className="text-xs text-muted-foreground">No completed runs yet. Be the first on the board.</p>}
        </div>
      )}
      {isLoading ? <div className="h-64 animate-pulse bg-secondary" /> : error || !round ? <EmptyState text="Higher or Lower is warming up." /> : (
        <>
          <Comparison round={round} revealedValue={result?.actualValue} />
          <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:px-5">
            {result && !result.correct ? (
              <button onClick={restart} className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#3d59e0] text-sm font-bold text-white"><RotateCcw className="h-4 w-4" />New run</button>
            ) : (
              <>
                <button disabled={isGuessing || !!result} onClick={() => choose("higher")} className="h-10 rounded-xl border border-primary bg-primary/10 text-xs font-bold text-primary hover:bg-primary/15">↑ Higher than {formatValue(round.category, round.itemA.value)}</button>
                <button disabled={isGuessing || !!result} onClick={() => choose("lower")} className="h-10 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-secondary">↓ Lower than {formatValue(round.category, round.itemA.value)}</button>
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            <span className={result ? (result.correct ? "font-bold text-[#16A34A]" : "font-bold text-[#DC2626]") : "font-semibold text-[#D97706]"}>{result ? (result.correct ? "✓ Correct — next round" : "✕ Run ended") : `🔥 Current run: ${round.runCount}`}</span>
            <span>Best {round.bestRun} · Round {round.runCount + 1} of ∞</span>
          </div>
        </>
      )}
    </section>
  );
}

function SentimentBars({ question }: { question: SentimentQuestion }) {
  const total = question.yesCount + question.noCount;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[24px_1fr_38px] items-center gap-2 text-xs"><span>👍</span><div className="h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-green-600 transition-all dark:bg-green-500" style={{ width: `${question.yesPercent}%` }} /></div><b className="text-right text-green-600 dark:text-green-400">{question.yesPercent}%</b></div>
      <div className="grid grid-cols-[24px_1fr_38px] items-center gap-2 text-xs"><span>👎</span><div className="h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-red-600 transition-all dark:bg-red-500" style={{ width: `${question.noPercent}%` }} /></div><b className="text-right text-red-600 dark:text-red-400">{question.noPercent}%</b></div>
      <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground"><span>{total.toLocaleString()} votes today</span>{question.gameTag && <span className="rounded-full bg-secondary px-2 py-1 text-primary">🔥 {question.gameTag}</span>}</div>
    </div>
  );
}

function SentimentCard({ question }: { question: SentimentQuestion }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { vote, isVoting } = useSentiment();
  const submit = (choice: "yes" | "no") => isAuthenticated ? vote({ id: question.id, vote: choice }) : openAuthModal("sentiment_vote" as never);
  return (
    <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/20">
      <p className="mb-3 text-sm font-bold leading-snug text-foreground">{question.question}</p>
      {question.userVote ? <SentimentBars question={question} /> : (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={isVoting} onClick={() => submit("yes")} className="rounded-xl border border-green-500/30 bg-green-500/10 py-2.5 text-sm font-bold text-green-600 dark:text-green-400">👍 Yes</button>
          <button disabled={isVoting} onClick={() => submit("no")} className="rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-bold text-red-600 dark:text-red-400">👎 No</button>
        </div>
      )}
      {question.userVote && <div className="mt-3 flex items-center gap-2"><span className="inline-flex rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-600 dark:text-green-400">You voted {question.userVote === "yes" ? "👍" : "👎"}</span><button disabled={isVoting} onClick={() => submit(question.userVote === "yes" ? "no" : "yes")} className="text-[10px] font-semibold text-primary hover:underline">Switch to {question.userVote === "yes" ? "👎" : "👍"}</button></div>}
    </article>
  );
}

export function SentimentSection() {
  const { questions, isLoading, error } = useSentiment();
  return (
    <section className="border-b border-border bg-card">
      <SectionHeader icon={<Radio className="h-4 w-4" />} title="Community sentiment" context={<span className="text-[#16A34A]">● Live pulse</span>} action="All topics →" />
      <div className="space-y-3 p-4 sm:p-5">{isLoading ? <div className="h-40 animate-pulse rounded-xl bg-secondary" /> : error || !questions.length ? <EmptyState text="No community pulse is active yet." /> : questions.map((q) => <SentimentCard key={q.id} question={q} />)}</div>
    </section>
  );
}

export function HistorySection() {
  const { data: facts = [], isLoading } = useTodayInGamingHistory();
  const [index, setIndex] = useState(0);
  const fact = facts[index];
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date());
  const shareFact = async () => {
    if (!fact) return;
    const text = `${fact.headline} — ${fact.description}`;
    try {
      if (navigator.share) await navigator.share({ title: "This day in gaming history", text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        toast.success("Gaming moment copied to your clipboard");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") toast.error("This moment could not be shared");
    }
  };
  return (
    <section className="border-b border-border bg-card p-4 sm:p-5">
      <div className="overflow-hidden rounded-2xl bg-[#0A1628] text-white">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><Clock3 className="h-4 w-4 text-[#AFA9EC]" /></span><h2 className="text-sm font-bold">This day in gaming history</h2></div>
        {isLoading ? <div className="h-48 animate-pulse bg-white/5" /> : !fact ? <div className="p-8 text-center text-sm text-white/50">No curated moment is published for {monthDay} yet.</div> : (
          <div className="p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#AFA9EC]">{monthDay}</p>
            <div className="grid grid-cols-[76px_1fr] gap-4">
              <div className="flex h-20 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5"><b className="text-2xl text-[#FCD34D]">{fact.year}</b><span className="text-[9px] text-white/40">{new Date().getFullYear() - fact.year} yrs ago</span></div>
              <div><h3 className="text-base font-bold">{fact.headline}</h3><p className="mt-2 text-xs leading-relaxed text-white/55">{fact.description}</p>{fact.gameTag && <span className="mt-3 inline-flex rounded-full bg-white/10 px-2 py-1 text-[9px] text-white/70">{fact.gameTag}</span>}</div>
            </div>
            <div className="mt-5 flex items-center"><button type="button" onClick={() => void shareFact()} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[10px] font-semibold hover:bg-white/15"><Share2 className="h-3 w-3" />Share this moment</button><div className="ml-auto flex items-center gap-1"><button aria-label="Previous history fact" onClick={() => setIndex((index - 1 + facts.length) % facts.length)} className="rounded-lg p-2 hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button><span className="text-[10px] text-white/35">{index + 1}/{facts.length}</span><button aria-label="Next history fact" onClick={() => setIndex((index + 1) % facts.length)} className="rounded-lg p-2 hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button></div></div>
          </div>
        )}
      </div>
    </section>
  );
}

export function FeedHigherLowerCard() {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { round, isLoading, guess, isGuessing, refetch } = useHigherLower();
  const [result, setResult] = useState<{ correct: boolean; actualValue: number } | null>(null);
  const choose = async (choice: "higher" | "lower") => {
    if (!isAuthenticated) return openAuthModal("higher_lower_feed" as never);
    if (!round || result) return;
    const value = await guess({ roundId: round.id, guess: choice });
    setResult({ correct: value.correct, actualValue: value.actualValue });
  };
  if (isLoading || !round) return <CompactSkeleton />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Higher or Lower" context={round.categoryLabel} />
      <Comparison round={round} revealedValue={result?.actualValue} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-4"><button disabled={isGuessing || !!result} onClick={() => choose("higher")} className="rounded-xl border border-primary bg-primary/10 py-2.5 text-xs font-bold text-primary">↑ Higher</button><button disabled={isGuessing || !!result} onClick={() => choose("lower")} className="rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground hover:bg-secondary">↓ Lower</button></div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[11px] text-muted-foreground"><span>👥 {round.totalGuesses.toLocaleString()} guessed today</span>{result && <Link onClick={() => void refetch()} className="font-bold text-primary" to="/hub#higher-lower">See full results on Hub →</Link>}</div>
    </div>
  );
}

export function FeedSentimentCard() {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { questions, isLoading, vote, isVoting } = useSentiment(1);
  const question = questions[0];
  const submit = (choice: "yes" | "no") => isAuthenticated ? vote({ id: question.id, vote: choice }) : openAuthModal("sentiment_feed" as never);
  if (isLoading || !question) return <CompactSkeleton />;
  const totalVotes = question.yesCount + question.noCount;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Radio className="h-4 w-4" /></span><h3 className="text-sm font-bold text-foreground">Community sentiment</h3></div>
      <p className="mb-4 text-base font-bold leading-snug text-foreground">{question.question}</p>
      {question.userVote ? <SentimentBars question={question} /> : <><div className="grid grid-cols-2 gap-2"><button disabled={isVoting} onClick={() => submit("yes")} className="rounded-xl border border-green-500/30 bg-green-500/10 py-3 font-bold text-green-600 dark:text-green-400">👍 Yes</button><button disabled={isVoting} onClick={() => submit("no")} className="rounded-xl border border-red-500/30 bg-red-500/10 py-3 font-bold text-red-600 dark:text-red-400">👎 No</button></div><p className="mt-3 text-[11px] text-muted-foreground">{totalVotes.toLocaleString()} votes today</p></>}
      {question.userVote && <Link className="mt-4 block text-right text-xs font-bold text-primary" to="/hub#sentiment">See full results on Hub →</Link>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-border p-7 text-center text-xs text-muted-foreground">{text}</div>; }
function CompactSkeleton() { return <div className="h-72 animate-pulse rounded-2xl border border-border bg-card p-5"><div className="h-full rounded-xl bg-secondary" /></div>; }
