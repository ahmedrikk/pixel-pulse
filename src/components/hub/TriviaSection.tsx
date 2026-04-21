import { useState, useEffect } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";

interface TriviaOption {
  letter: string;
  text: string;
}

interface TriviaCardData {
  id: string;
  type: "daily" | "bonus";
  category: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  question: string;
  options: TriviaOption[];
  correctLetter: string;
  xpReward: number;
  streakDays: number;
  totalAnswered: number;
  correctPercent: number;
  resetsAt: Date;
  userAnswer: string | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Action RPG": { bg: "#EEEDFE", text: "#3C3489" },
  "FPS": { bg: "#FEF2F2", text: "#991B1B" },
  "Strategy": { bg: "#EAF3DE", text: "#166534" },
  "Racing": { bg: "#FAEEDA", text: "#633806" },
  "Indie": { bg: "#E1F5EE", text: "#085041" },
};

const MOCK_TRIVIA: TriviaCardData[] = [
  {
    id: "daily-1",
    type: "daily",
    category: "FPS",
    difficulty: "Medium",
    question: "Which game introduced the 'Battle Royale' genre to mainstream gaming with its 2017 launch?",
    options: [
      { letter: "A", text: "DayZ" },
      { letter: "B", text: "PUBG: Battlegrounds" },
      { letter: "C", text: "Fortnite" },
      { letter: "D", text: "H1Z1" },
    ],
    correctLetter: "B",
    xpReward: 120,
    streakDays: 7,
    totalAnswered: 14820,
    correctPercent: 61,
    resetsAt: new Date(new Date().setHours(24, 0, 0, 0)),
    userAnswer: null,
  },
  {
    id: "bonus-1",
    type: "bonus",
    category: "Action RPG",
    difficulty: "Hard",
    question: "In Elden Ring, what is the name of the destined death rune?",
    options: [
      { letter: "A", text: "Rune of Death" },
      { letter: "B", text: "Miquella's Needle" },
      { letter: "C", text: "Godwyn's Seal" },
      { letter: "D", text: "Death's Poker" },
    ],
    correctLetter: "A",
    xpReward: 80,
    streakDays: 7,
    totalAnswered: 6240,
    correctPercent: 38,
    resetsAt: new Date(new Date().setHours(24, 0, 0, 0)),
    userAnswer: null,
  },
];

function getTimeRemaining(date: Date): string {
  const diff = date.getTime() - Date.now();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hrs}h ${mins}m`;
}

function TriviaCard({ data }: { data: TriviaCardData }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(data.userAnswer);
  const [revealed, setRevealed] = useState(!!data.userAnswer);

  const categoryStyle = CATEGORY_COLORS[data.category] || { bg: "hsl(var(--secondary))", text: "hsl(var(--muted-foreground))" };

  const handleAnswer = (letter: string) => {
    if (revealed) return;
    if (!isAuthenticated) {
      openAuthModal("trivia_answer" as never);
      return;
    }
    setSelectedLetter(letter);
    setRevealed(true);
    const isCorrect = letter === data.correctLetter;
    if (isCorrect) {
      addXP(data.xpReward);
      toast.success(`+${data.xpReward} XP earned! 🎉`, { description: "Correct answer!" });
    } else {
      toast.error("Incorrect! Better luck tomorrow.", { description: `The answer was ${data.correctLetter}.` });
    }
  };

  const getOptionStyle = (letter: string) => {
    if (!revealed) return { border: "0.5px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))" };
    if (letter === data.correctLetter) return { border: "0.5px solid #16A34A", background: "#EAF3DE", color: "#16A34A", fontWeight: 500 };
    if (letter === selectedLetter) return { border: "0.5px solid #DC2626", background: "#FEF2F2", color: "#DC2626" };
    return { border: "0.5px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", opacity: 0.5 };
  };

  const getBubbleStyle = (letter: string) => {
    if (!revealed) return { background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" };
    if (letter === data.correctLetter) return { background: "#16A34A", color: "#fff" };
    if (letter === selectedLetter) return { background: "#DC2626", color: "#fff" };
    return { background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" };
  };

  return (
    <div style={{ border: "0.5px solid hsl(var(--border))", borderRadius: 12, overflow: "hidden" }}>
      {/* Header panel */}
      <div style={{
        background: "#0A1628", padding: "11px 14px",
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 8, fontWeight: 500, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
            {data.type === "daily" ? "Today's Challenge" : "Bonus Round"}
          </p>
          {data.type === "daily" ? (
            <p style={{ fontSize: 11, fontWeight: 500, color: "#FCD34D" }}>🔥 {data.streakDays} day streak!</p>
          ) : (
            <p style={{ fontSize: 11, fontWeight: 500, color: "#AFA9EC" }}>{data.category} Special</p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            background: "rgba(83,74,183,0.25)", border: "0.5px solid rgba(83,74,183,0.4)",
            color: "#AFA9EC", fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 5, marginBottom: 3,
          }}>
            +{data.xpReward} XP
          </div>
          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.22)" }}>
            {revealed ? "Come back tomorrow" : `Resets in ${getTimeRemaining(data.resetsAt)}`}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        {/* Category + Difficulty */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: categoryStyle.bg, color: categoryStyle.text }}>
            {data.category}
          </span>
          <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>{data.difficulty}</span>
        </div>

        {/* Question */}
        <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", lineHeight: 1.45, marginBottom: 10 }}>
          {data.question}
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.options.map((opt) => (
            <button
              key={opt.letter}
              onClick={() => handleAnswer(opt.letter)}
              disabled={revealed}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 9px", borderRadius: 8,
                ...getOptionStyle(opt.letter),
                cursor: revealed ? "not-allowed" : "pointer",
                fontSize: 11, transition: "all 0.15s", textAlign: "left", width: "100%",
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 500, flexShrink: 0,
                ...getBubbleStyle(opt.letter),
              }}>
                {opt.letter}
              </span>
              {opt.text}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 9, borderTop: "0.5px solid hsl(var(--border))", marginTop: 10,
        }}>
          <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>
            {data.totalAnswered.toLocaleString()} answered · {data.correctPercent}% correct
          </span>
          <button style={{ fontSize: 9, color: "#534AB7", background: "#EEEDFE", border: "none", padding: "3px 7px", borderRadius: 5, cursor: "pointer" }}>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

export function TriviaSection() {
  return (
    <section style={{ padding: "18px 20px", borderBottom: "0.5px solid hsl(var(--border))" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 10 }}>🧠</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>Daily trivia</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5 }}>+200 XP today</span>
        </div>
        <button style={{ fontSize: 11, color: "#534AB7", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
          All trivia →
        </button>
      </div>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {MOCK_TRIVIA.map(card => (
          <TriviaCard key={card.id} data={card} />
        ))}
      </div>
    </section>
  );
}
