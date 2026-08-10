import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Bell, Check, Cpu, BookOpen, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAGE_CONFIG: Record<string, { icon: React.ReactNode; title: string; description: string; color: string }> = {
  hardware: {
    icon: <Cpu className="h-16 w-16" />,
    title: "Hardware",
    description: "GPU benchmarks, peripheral reviews, build guides, and tech deals — all in one place.",
    color: "text-blue-500",
  },
  guides: {
    icon: <BookOpen className="h-16 w-16" />,
    title: "Guides",
    description: "Pro tips, walkthroughs, tier lists, and strategy guides for your favourite games.",
    color: "text-blue-500",
  },
};

export default function ComingSoon() {
  const location = useLocation();
  const slug = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const { isAuthenticated, isLoading: isAuthLoading, openAuthModal } = useAuthGate();
  const [isJoining, setIsJoining] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);

  useEffect(() => {
    if (slug !== "battle-pass" || !isAuthenticated) {
      setIsOnWaitlist(false);
      return;
    }
    supabase.rpc("is_on_battle_pass_waitlist")
      .then(({ data, error }) => {
        if (!error) setIsOnWaitlist(Boolean(data));
      });
  }, [isAuthenticated, slug]);

  async function handleBattlePassNotify() {
    if (!isAuthenticated) {
      openAuthModal("battlepass");
      return;
    }
    setIsJoining(true);
    const { error } = await supabase.rpc("join_battle_pass_waitlist");
    setIsJoining(false);
    if (error) {
      console.error("Battle Pass waitlist error:", error);
      toast.error("We couldn't add you right now. Please try again.");
      return;
    }
    setIsOnWaitlist(true);
    toast.success("You're on the Battle Pass notification list!");
  }

  if (slug === "battle-pass") {
    return (
      <div className="min-h-screen pb-16 md:pb-0">
        <SiteLayout>
          <div className="mx-auto w-full max-w-3xl py-2 sm:py-4">
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
              <img
                src="/battle-pass-coming-soon.jpg"
                alt="Talus Battle Pass coming soon — stay tuned"
                className="block h-auto w-full"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-5 pt-20 sm:px-8 sm:pb-8">
                <Button
                  type="button"
                  size="lg"
                  onClick={handleBattlePassNotify}
                  disabled={isJoining || isAuthLoading || isOnWaitlist}
                  className="mx-auto flex min-w-52 gap-2 rounded-full shadow-xl"
                >
                  {isJoining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isOnWaitlist ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  {isOnWaitlist ? "You're on the list" : "Notify me"}
                </Button>
              </div>
            </div>
          </div>
        </SiteLayout>
        <BottomNavBar />
        <Footer />
      </div>
    );
  }

  const page = PAGE_CONFIG[slug] ?? {
    icon: <Clock className="h-16 w-16" />,
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    description: "Something awesome is on the way.",
    color: "text-primary",
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className={`mb-6 ${page.color} opacity-80`}>{page.icon}</div>
          <h1 className="text-4xl font-black mb-2">
            {page.title} <span className="text-primary">Coming Soon</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mt-3">{page.description}</p>
          <div className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-muted-foreground text-sm font-medium">
            <Clock className="h-4 w-4" />
            In development — stay tuned
          </div>
        </div>
      </SiteLayout>
      <BottomNavBar />
      <Footer />
    </div>
  );
}
