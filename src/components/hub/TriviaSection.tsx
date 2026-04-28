import { useState } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";
import { useTrivia, type TriviaCardData } from "@/hooks/useTrivia";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Action RPG": { bg: "#EEEDFE", text: "#3C3489" },
  "FPS": { bg: "#FEF2F2", text: "#991B1B" },
  "Strategy": { bg: "#EAF3DE", text: "#166534" },
  "Racing": { bg: "#FAEEDA", text: "#633806" },
  "Indie": { bg: "#E1F5EE", text: "#085041" },
};

function getTimeRemaining(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "0h 0m";
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hrs}h ${mins}m`;
}

function TriviaCard({ data }: { data: TriviaCardData }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const { answerTrivia } = useTrivia();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const revealed = !!data.userAnswer;
  const selectedLetter = data.userAnswer;

  const categoryStyle = CATEGORY_COLORS[data.category] || { bg: "hsl(var(--secondary))", text: "hsl(var(--muted-foreground))" };

  const handleAnswer = async (letter: string) => {
    if (revealed || isSubmitting) return;
    if (!isAuthenticated) {
      openAuthModal("trivia_answer" as never);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await answerTrivia({ id: data.id, selectedLetter: letter });
      if (result.isCorrect) {
        addXP(result.xpAwarded);
        toast.success(`+${result.xpAwarded} XP earned! 🎉`, { description: "Correct answer!" });
      } else {
        toast.error("Incorrect! Better luck tomorrow.", { description: `The answer was ${result.correctLetter}.` });
      }
    } catch (error) {
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
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
    <div style={{ border: "0.5px solid hsl(var(--border))", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {data.options.map((opt) => (
            <button
              key={opt.letter}
              onClick={() => handleAnswer(opt.letter)}
              disabled={revealed || isSubmitting}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 9px", borderRadius: 8,
                ...getOptionStyle(opt.letter),
                cursor: (revealed || isSubmitting) ? "not-allowed" : "pointer",
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

        {/* Explanation Reveal */}
        {revealed && (
          <div style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: selectedLetter === data.correctLetter ? "#EAF3DE" : "#FEF2F2",
            border: `0.5px solid ${selectedLetter === data.correctLetter ? "#16A34A" : "#DC2626"}`,
            color: selectedLetter === data.correctLetter ? "#166534" : "#991B1B",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              {selectedLetter === data.correctLetter ? "✓ Correct!" : "✗ Wrong answer"}
            </p>
            <p style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
              {data.explanation}
            </p>
            <p style={{ fontSize: 10, fontWeight: 500, opacity: 0.8 }}>
              {selectedLetter === data.correctLetter ? `+${data.xpReward} XP earned` : "Come back tomorrow"}
            </p>
          </div>
        )}

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
  const { triviaItems, isLoading } = useTrivia();

  return (
    <section style={{ padding: "18px 20px", borderBottom: "0.5px solid hsl(var(--border))" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 10 }}>🧠</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>Daily trivia</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5 }}>
            +200 XP today
          </span>
        </div>
        <button style={{ fontSize: 11, color: "#534AB7", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
          All trivia →
        </button>
      </div>

      {/* 2-column grid */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ height: 250, background: "hsl(var(--secondary))", borderRadius: 12, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
          <div style={{ height: 250, background: "hsl(var(--secondary))", borderRadius: 12, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {triviaItems.map(card => (
            <TriviaCard key={card.id} data={card} />
          ))}
        </div>
      )}
    </section>
  );
}
