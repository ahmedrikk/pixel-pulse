import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gamepad2, Mail, Lock, Globe, Trophy, Star, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SoftBlockAuthModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export function SoftBlockAuthModal({ isOpen, onDismiss }: SoftBlockAuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with auth
    onDismiss();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-md"
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {/* Glow accents */}
              <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />

              {/* Close button */}
              <button
                onClick={onDismiss}
                className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="relative px-8 pt-8 pb-2 text-center">
                {/* Avatar icon */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary shadow-lg">
                  <Gamepad2 className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {mode === "signup" ? "Join LevelUpXP" : "Welcome Back"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "signup"
                    ? "Post reviews, track favorites & unlock achievements 🎮"
                    : "Sign in to continue your journey"}
                </p>
              </div>

              {/* Value props (signup only) */}
              {mode === "signup" && (
                <div className="mx-8 mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-accent" /> Achievements
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-accent" /> Reviews
                  </span>
                  <span className="flex items-center gap-1">
                    <Bookmark className="h-3.5 w-3.5 text-accent" /> Favorites
                  </span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="relative space-y-3 px-8 pt-5 pb-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    required
                  />
                </div>
                {mode === "signup" && (
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="pl-10 bg-secondary border-border"
                    />
                  </div>
                )}

                <Button type="submit" className="w-full font-semibold">
                  {mode === "signup" ? "Create Account" : "Sign In"}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 px-8">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or continue with</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Social logins */}
              <div className="flex gap-3 px-8 pt-4">
                <Button variant="outline" className="flex-1 gap-2 text-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Discord
                </Button>
                <Button variant="outline" className="flex-1 gap-2 text-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
              </div>

              {/* Footer */}
              <div className="px-8 pt-4 pb-6 text-center">
                <button
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mode === "signup"
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
                </button>
                <div className="mt-3">
                  <button
                    onClick={onDismiss}
                    className="text-xs text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2 transition-colors"
                  >
                    Continue as Guest
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
