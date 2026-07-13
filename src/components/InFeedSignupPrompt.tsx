import { useAuthGate } from "@/contexts/AuthGateContext";
import { TalusLogo } from "@/components/TalusLogo";

export function InFeedSignupPrompt() {
  const { openSignupPrompt } = useAuthGate();

  return (
    <div className="bg-card border rounded-2xl p-5 card-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <TalusLogo size={44} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-foreground leading-tight">
            Talus is the home for people who live games.
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Join the community. Track your stats, predict matches, and earn rewards.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={openSignupPrompt}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Log in
            </button>
            <button
              onClick={openSignupPrompt}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create new account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
