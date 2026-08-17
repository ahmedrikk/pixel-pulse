import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TalusLogo } from "@/components/TalusLogo";
import { GENERIC_LOGIN_ERROR, loginWithPassword, signupWithPassword } from "@/lib/authApi";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const signupPasswordSchema = z.string().min(10).max(128).regex(/[A-Za-z]/, "Password must include a letter").regex(/\d/, "Password must include a number");
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function TurnstileChallenge({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
        theme: "auto",
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-talus-turnstile]');
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.talusTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className="flex min-h-[65px] justify-center" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthGatePopup() {
  const { isAuthModalOpen, closeAuthModal } = useAuthGate();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<"main" | "email">("main");
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const openedAt = useRef(Date.now());
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Reset state when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode("main");
      setTab("signup");
      setEmail("");
      setPassword("");
      setAuthError(null);
      setEmailSent(false);
      setIsLoading(null);
      setWebsite("");
      setCaptchaToken("");
      openedAt.current = Date.now();
    }
  }, [isAuthModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal("x_button");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthModalOpen, closeAuthModal]);

  const getRedirectUrl = () => {
    return window.location.origin + window.location.pathname + window.location.search;
  };

  const handleOAuth = async (provider: "google") => {
    setIsLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getRedirectUrl() },
      });
      if (error) {
        toast.error(`Failed to connect with ${provider}`);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (website || Date.now() - openedAt.current < 800) {
      setAuthError("Please wait a moment and try again");
      return;
    }
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setAuthError(tab === "login" ? GENERIC_LOGIN_ERROR : "Unable to create account with those details");
      return;
    }
    if (tab === "signup") {
      const parsedPassword = signupPasswordSchema.safeParse(password);
      if (!parsedPassword.success) {
        setAuthError(parsedPassword.error.issues[0]?.message || "Use at least 10 characters with a letter and number");
        return;
      }
    } else if (password.length < 6 || password.length > 128) {
      setAuthError(GENERIC_LOGIN_ERROR);
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setAuthError("Please complete the security check");
      return;
    }
    setIsLoading("email");
    try {
      if (tab === "signup") {
        const result = await signupWithPassword(parsedEmail.data, password, getRedirectUrl(), captchaToken || undefined);
        if (result.signedIn) {
          closeAuthModal("signup_success");
          window.location.reload();
        } else {
          setEmailSent(true);
        }
      } else {
        await loginWithPassword(parsedEmail.data, password, captchaToken || undefined);
        closeAuthModal("login_success");
        window.location.reload();
      }
    } catch (e: unknown) {
      setAuthError(tab === "login"
        ? GENERIC_LOGIN_ERROR
        : "Account creation is temporarily unavailable. Please try again later.");
    } finally {
      setIsLoading(null);
    }
  };

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
            className="fixed inset-0 z-[9998] bg-black/50"
          />

          {/* Modal Container */}
          <motion.div
            ref={sheetRef}
            drag={isMobile ? "y" : false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 80) closeAuthModal("swipe");
            }}
            variants={isMobile ? modalVariantsMobile : modalVariantsDesktop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              fixed z-[9999] overflow-hidden
              md:top-1/2 md:left-1/2 md:w-full md:max-w-[420px] md:rounded-[24px] md:shadow-2xl
              max-md:bottom-0 max-md:left-0 max-md:w-full max-md:rounded-t-[24px] max-md:rounded-b-none
            `}
          >
            {/* Pastel pixelated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:from-black dark:via-neutral-950 dark:to-black" />
            <div
              className="absolute inset-0 opacity-30 dark:opacity-20"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,0.4) 20px),
                  repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,0.4) 20px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            {/* Content */}
            <div className="relative bg-card/80 backdrop-blur-xl border border-white/40 dark:border-white/10 p-6 md:p-8">
              {/* Mobile Drag Handle */}
              {isMobile && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-foreground/20" />
              )}

              {/* Close Button */}
              <button
                onClick={() => closeAuthModal("x_button")}
                className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              {mode === "main" ? (
                <div className="flex flex-col items-center text-center pt-4">
                  {/* Logo */}
                  <TalusLogo size={52} />

                  {/* Tagline */}
                  <h2 className="mt-4 text-2xl font-bold text-foreground">
                    The home for people who live games.
                  </h2>

                  {/* Consent text */}
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed max-w-[320px]">
                    By continuing, you agree to our{" "}
                    <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>{" "}
                    and acknowledge that you have read our{" "}
                    <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                  </p>

                  {/* Auth buttons */}
                  <div className="w-full flex flex-col gap-3 mt-6">
                    {/* Google */}
                    <button
                      onClick={() => handleOAuth("google")}
                      disabled={isLoading !== null}
                      className="w-full flex items-center justify-center h-11 rounded-xl bg-card border border-border hover:bg-secondary transition-colors disabled:opacity-60"
                    >
                      {isLoading === "google" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          <span className="text-sm font-medium text-foreground">Continue with Google</span>
                        </>
                      )}
                    </button>

                    {/* Email */}
                    <button
                      onClick={() => setMode("email")}
                      disabled={isLoading !== null}
                      className="w-full flex items-center justify-center h-11 rounded-xl bg-card border border-border hover:bg-secondary transition-colors disabled:opacity-60"
                    >
                      <Mail className="w-5 h-5 mr-3 text-foreground" />
                      <span className="text-sm font-medium text-foreground">Use email</span>
                    </button>
                  </div>

                  {/* Toggle Link */}
                  <div className="mt-6 text-center">
                    <span className="text-sm text-muted-foreground">
                      Already a member?{" "}
                      <button
                        onClick={() => { setTab("login"); setMode("email"); }}
                        className="text-primary font-medium hover:underline"
                      >
                        Log in
                      </button>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  {/* Back to main */}
                  <button
                    onClick={() => setMode("main")}
                    className="text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    ← Back
                  </button>

                  {/* Tabs */}
                  <div className="flex h-10 rounded-xl border border-border overflow-hidden mb-5 p-0.5 bg-secondary">
                    <button
                      onClick={() => setTab("signup")}
                      className={`flex-1 rounded-lg text-sm transition-all duration-150 ${
                        tab === "signup" ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-muted-foreground hover:bg-foreground/5"
                      }`}
                    >
                      Sign up
                    </button>
                    <button
                      onClick={() => setTab("login")}
                      className={`flex-1 rounded-lg text-sm transition-all duration-150 ${
                        tab === "login" ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-muted-foreground hover:bg-foreground/5"
                      }`}
                    >
                      Log in
                    </button>
                  </div>

                  {emailSent ? (
                    <div className="text-center py-6">
                      <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
                      <h3 className="text-base font-medium text-foreground mb-1">Check your inbox</h3>
                      <p className="text-muted-foreground text-sm">If this email can be registered, a confirmation link will arrive shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleEmail} className="flex flex-col gap-3">
                      <input
                        type="text"
                        name="website"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="absolute -left-[10000px] h-px w-px opacity-0"
                      />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                        placeholder="you@example.com"
                        disabled={isLoading !== null}
                        className="h-11 rounded-xl"
                        autoComplete="email"
                        maxLength={254}
                      />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                        placeholder={tab === "signup" ? "Password (10+ chars, letter + number)" : "Password"}
                        disabled={isLoading !== null}
                        className="h-11 rounded-xl"
                        autoComplete={tab === "signup" ? "new-password" : "current-password"}
                        maxLength={128}
                      />
                      {authError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-left dark:border-red-900/60 dark:bg-red-950/30">
                          <p className="text-xs leading-relaxed text-red-600 dark:text-red-300">{authError}</p>
                        </div>
                      )}
                      <TurnstileChallenge onToken={setCaptchaToken} />
                      <Button
                        type="submit"
                        disabled={isLoading !== null || !email || !password}
                        className="h-11 rounded-xl"
                      >
                        {isLoading === "email" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {tab === "signup" ? "Create account" : "Log in"}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
