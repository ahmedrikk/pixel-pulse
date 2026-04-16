import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Star, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Constants & Copy ─────────────────────────────────────────────────────────

const HEADLINES: Record<string, string> = {
  scroll: "You've read [N] articles. None of it counted.",
  like: "Like articles, earn XP. It takes 10 seconds to join.",
  comment: "Join 12,000 gamers already in the conversation.",
  bookmark: "Save it for later — your reading list is one sign-up away.",
  battlepass: "Your XP is waiting. Season 1 started without you.",
  predict: "Predict. Win XP. Be right before anyone else.",
  review: "Your review matters. Sign up to be heard.",
  signup_prompt: "Your XP is waiting. Season 1 started without you.",
};

const SUBHEADLINE =
  "Join free and start earning XP for every article you read, every prediction you make, and every review you leave.";

const PERKS = [
  {
    title: "Earn XP while you read",
    desc: "Every article adds to your Battle Pass",
    bg: "#EEEDFE",
    color: "#534AB7",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1L9.2 5.5H14L10.4 8.2L11.8 13L7.5 10.5L3.2 13L4.6 8.2L1 5.5H5.8L7.5 1Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Your games, front and centre",
    desc: "Feed personalised to what you actually play",
    bg: "#E6F1FB",
    color: "#185FA5",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 5V3.5a3 3 0 016 0V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7.5" cy="9" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Predict matches, win XP",
    desc: "Call esports results before they happen",
    bg: "#FAEEDA",
    color: "#D97706",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M7.5 1v3 M7.5 14v-3 M1 7.5h3 M14 7.5h-3 M3 3l2 2 M12 12l-2-2 M3 12l2-2 M12 3l-2 2" />
      </svg>
    ),
  },
  {
    title: "Build your gamer profile",
    desc: "Badges, reviews and season history",
    bg: "#E1F5EE",
    color: "#0D9488",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 1.5L12.5 4v3.5c0 3-2.5 4.5-5 5.5C5 12 2.5 10.5 2.5 7.5V4L7.5 1.5z" />
        <path d="M5 7l2 2 3-3" />
      </svg>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthGatePopup() {
  const { isAuthModalOpen, authModalContext, closeAuthModal, articleScrollCount } = useAuthGate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync animation state
  const handleTabSwitch = (newTab: "signup" | "login") => {
    if (newTab === tab) return;
    setIsSwitching(true);
    setTimeout(() => {
      setTab(newTab);
      setIsSwitching(false);
    }, 120);
  };

  // Auth Submit Handlers
  const getRedirectUrl = () => {
    const baseUrl = window.location.origin;
    const pathname = window.location.pathname;
    if (pathname.includes('/pixel-pulse/')) {
      return `${baseUrl}/pixel-pulse/`;
    }
    return baseUrl + '/';
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setIsLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectUrl(),
        },
      });
      if (error) {
        toast.error(`Failed to connect with ${provider === 'google' ? 'Google' : 'Apple'}`);
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      // Basic shake handled by CSS class or just toast for now
      toast.error("Please enter a valid email");
      return;
    }
    setIsLoading("email");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      setTimeout(() => {
        closeAuthModal("continue_link");
        setMagicLinkSent(false);
      }, 4000);
    } catch (e: any) {
      toast.error(e.message || "Failed to send login link");
    } finally {
      setIsLoading(null);
    }
  };

  // Dynamic Headline parsing
  const rawHeadline = HEADLINES[authModalContext || "signup_prompt"] || HEADLINES.signup_prompt;
  let renderHeadline = <span className="text-white">{rawHeadline}</span>;
  
  if (authModalContext === "scroll") {
    const count = Math.min(Math.max(articleScrollCount, 3), 99);
    renderHeadline = (
      <>
        <span className="text-white">You've read {count} articles. </span>
        <span className="text-amber-200">None of it counted.</span>
      </>
    );
  }

  // Framer motion variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
  };

  const modalVariantsDesktop = {
    hidden: { opacity: 0, scale: 0.92, x: "-50%", y: "-50%" },
    visible: { opacity: 1, scale: 1, x: "-50%", y: "-50%", transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.94, x: "-50%", y: "-50%", transition: { duration: 0.15, ease: "easeIn" } },
  };

  const modalVariantsMobile = {
    hidden: { y: "100%" },
    visible: { y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
    exit: { y: "100%", transition: { duration: 0.2, ease: "easeIn" } },
  };

  return (
    <AnimatePresence>
      {isAuthModalOpen && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={() => closeAuthModal("overlay")}
            className="fixed inset-0 z-[9998] bg-[#0A1628]/65"
            style={{ backdropFilter: "none" }} // No blur as requested
          />

          {/* Modal Container */}
          <motion.div
            ref={sheetRef}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 80) closeAuthModal("swipe");
            }}
            variants={isMobile ? modalVariantsMobile : modalVariantsDesktop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              fixed z-[9999] overflow-hidden bg-white
              md:top-1/2 md:left-1/2 md:w-full md:max-w-[440px] md:rounded-[20px] md:shadow-2xl md:border md:border-white/10
              max-md:bottom-0 max-md:left-0 max-md:w-full max-md:rounded-t-[20px] max-md:rounded-b-none
            "
          >
            {/* ── Dark Header Panel ── */}
            <div className="bg-[#0F2347] pt-[26px] max-md:pt-5 pb-[22px] px-[26px] relative rounded-t-[20px]">
              {/* Mobile Drag Handle */}
              {isMobile && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-white/20" />
              )}
              
              {/* Close Button */}
              <button
                onClick={() => closeAuthModal("x_button")}
                className="absolute top-[26px] right-[26px] flex items-center justify-center w-[26px] h-[26px] rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2.5} />
              </button>

              {/* Badge Row */}
              <div className="flex items-center gap-[7px] mb-3">
                <span className="flex items-center gap-1.5 px-[8px] py-[3px] bg-emerald-500/12 border border-emerald-500/30 rounded-full text-[#6EE7B7] text-[10px] font-medium tracking-wide">
                  <div className="w-[5px] h-[5px] rounded-full bg-emerald-400" />
                  Season 1 live
                </span>
                
                {authModalContext === "scroll" && (
                  <span className="flex items-center gap-1 px-[8px] py-[3px] bg-amber-500/12 border border-amber-500/30 rounded-full text-[#FCD34D] text-[10px] font-medium tracking-wide">
                    <Star size={10} className="fill-[#FCD34D]" />
                    {Math.min(articleScrollCount, 99)} articles untracked
                  </span>
                )}
              </div>

              {/* Headline */}
              <h2 className="text-[21px] font-medium leading-[1.25] mb-2 pr-6">
                {renderHeadline}
              </h2>

              {/* Subheadline */}
              <p className="text-[12px] text-white/50 leading-[1.5] m-0">
                {SUBHEADLINE}
              </p>
            </div>

            {/* ── White Body Panel ── */}
            <div
              className={`px-6 pt-5 pb-[22px] transition-all duration-150 ${
                isSwitching ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              {magicLinkSent ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 text-[#534AB7] mx-auto mb-4" />
                  <h3 className="text-[16px] font-medium text-[#0F172A] mb-2">Check your inbox</h3>
                  <p className="text-[#64748B] text-[13px]">We sent you a magic link to sign in automatically.</p>
                </div>
              ) : (
                <>
                  {/* Perks Grid or Welcome Back */}
                  {tab === "signup" ? (
                    <div className="grid grid-cols-2 gap-2 mb-[18px]">
                      {PERKS.map((perk, i) => (
                        <div key={i} className="flex items-start gap-[9px] p-[10px] pb-[11px] rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC]">
                          <div
                            className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: perk.bg, color: perk.color }}
                          >
                            {perk.icon}
                          </div>
                          <div>
                            <h4 className="text-[11px] font-medium text-[#0F172A] mb-[2px] leading-[1.2]">{perk.title}</h4>
                            <p className="text-[10px] text-[#64748B] leading-[1.3] m-0">{perk.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <h3 className="text-[14px] font-medium text-[#0F172A] mb-4 text-center">
                      Welcome back. Your XP is waiting.
                    </h3>
                  )}

                  {/* Tabs */}
                  <div className="flex h-[34px] rounded-lg border border-[#E2E8F0] overflow-hidden mb-4 p-0.5 bg-[#F8FAFC]">
                    <button
                      onClick={() => handleTabSwitch("signup")}
                      className={`flex-1 rounded-md text-[13px] transition-all duration-150 ${
                        tab === "signup" ? "bg-[#534AB7] text-white font-medium shadow-sm" : "text-[#64748B] font-normal hover:bg-black/5"
                      }`}
                    >
                      Sign up free
                    </button>
                    <button
                      onClick={() => handleTabSwitch("login")}
                      className={`flex-1 rounded-md text-[13px] transition-all duration-150 ${
                        tab === "login" ? "bg-[#534AB7] text-white font-medium shadow-sm" : "text-[#64748B] font-normal hover:bg-black/5"
                      }`}
                    >
                      Log in
                    </button>
                  </div>

                  {/* Auth Buttons */}
                  <div className="flex flex-col gap-[9px] mb-3">
                    {/* Google */}
                    <button
                      onClick={() => handleOAuth("google")}
                      disabled={isLoading !== null}
                      className="w-full flex items-center justify-center h-[42px] max-md:h-[48px] rounded-[9px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors"
                    >
                      {isLoading === "google" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
                      ) : (
                        <>
                          <svg className="w-[18px] h-[18px] mr-[10px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          <span className="text-[13px] font-medium text-[#0F172A]">Continue with Google</span>
                        </>
                      )}
                    </button>

                    {/* Apple */}
                    <button
                      onClick={() => handleOAuth("apple")}
                      disabled={isLoading !== null}
                      className="w-full flex items-center justify-center h-[42px] max-md:h-[48px] rounded-[9px] border border-[#E2E8F0] max-md:border-black bg-white dark:bg-black text-[#0F172A] dark:text-white transition-colors"
                    >
                      {isLoading === "apple" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-current" />
                      ) : (
                        <>
                          <svg className="w-[18px] h-[18px] mr-[10px]" viewBox="0 0 384 512" fill="currentColor">
                            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                          </svg>
                          <span className="text-[13px] font-medium text-current">Continue with Apple</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Divider Row */}
                  <div className="flex items-center gap-[10px] mb-[14px]">
                    <div className="flex-1 h-[0.5px] bg-[#E2E8F0]" />
                    <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">or continue with email</span>
                    <div className="flex-1 h-[0.5px] bg-[#E2E8F0]" />
                  </div>

                  {/* Email Form */}
                  <form onSubmit={handleEmail} className="flex gap-[7px] mb-4">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={isLoading !== null}
                      className="flex-1 h-[38px] rounded-lg border-[#CBD5E1] px-3 text-[12px] shadow-sm bg-white"
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading !== null || !email}
                      className="h-[38px] px-4 rounded-lg bg-[#534AB7] hover:bg-[#3C3489] text-white text-[12px] font-medium whitespace-nowrap"
                    >
                      {isLoading === "email" ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                      {tab === "signup" ? "Join free →" : "Log in →"}
                    </Button>
                  </form>

                  {/* Toggle Link */}
                  <div className="text-center mb-5">
                    {tab === "signup" ? (
                      <span className="text-[12px] text-[#0F172A]">
                        Already have an account?{" "}
                        <button onClick={() => handleTabSwitch("login")} className="text-[#534AB7] font-medium hover:underline">
                          Log in
                        </button>
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#0F172A]">
                        New here?{" "}
                        <button onClick={() => handleTabSwitch("signup")} className="text-[#534AB7] font-medium hover:underline">
                          Create a free account
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Legal Line */}
              <p className="text-center text-[10px] text-[#94A3B8] leading-[1.4] m-0 pb-1">
                By joining you agree to our <a href="#" className="underline hover:text-[#0F172A]">Terms of Service</a> and <a href="#" className="underline hover:text-[#0F172A]">Privacy Policy</a>.<br/>
                <span className="font-medium">Free forever — no credit card required.</span>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
