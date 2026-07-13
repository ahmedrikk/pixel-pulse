import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { AuthGateProvider } from "@/contexts/AuthGateContext";
import { AuthGatePopup } from "@/components/AuthGatePopup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { RouteFallback } from "@/components/RouteFallback";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Route-level code splitting — each page becomes its own chunk.
const Index          = lazy(() => import("./pages/Index"));
const Profile        = lazy(() => import("./pages/Profile"));
const Login          = lazy(() => import("./pages/Login"));
const SteamCallback  = lazy(() => import("./pages/SteamCallback"));
const PublicProfile  = lazy(() => import("./pages/PublicProfile"));
const DailyTrivia    = lazy(() => import("./pages/DailyTrivia"));
const Leaderboard    = lazy(() => import("./pages/Leaderboard"));
const Esports        = lazy(() => import("./pages/Esports"));
const GameCatalog    = lazy(() => import("./pages/GameCatalog"));
const GameReview     = lazy(() => import("./pages/GameReview"));
const Hub            = lazy(() => import("./pages/Hub"));
const BattlePass     = lazy(() => import("./pages/BattlePass"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const ComingSoon     = lazy(() => import("./pages/ComingSoon"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy  = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy   = lazy(() => import("./pages/CookiePolicy"));
const ContentGuidelines = lazy(() => import("./pages/ContentGuidelines"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <XPProvider>
          <AuthGateProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AuthGatePopup />
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Onboarding — no guard */}
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/onboarding/step-1" element={<Navigate to="/onboarding" replace />} />
                    <Route path="/onboarding/step-2" element={<Navigate to="/onboarding" replace />} />
                    <Route path="/onboarding/step-3" element={<Navigate to="/onboarding" replace />} />
                    <Route path="/onboarding/step-4" element={<Navigate to="/onboarding" replace />} />

                    {/* All other routes — guarded */}
                    <Route path="/" element={<OnboardingGuard><Index /></OnboardingGuard>} />
                    <Route path="/profile" element={<OnboardingGuard><Profile /></OnboardingGuard>} />
                    <Route path="/u/:username" element={<OnboardingGuard><PublicProfile /></OnboardingGuard>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/trivia" element={<OnboardingGuard><DailyTrivia /></OnboardingGuard>} />
                    <Route path="/leaderboard" element={<OnboardingGuard><Leaderboard /></OnboardingGuard>} />
                    <Route path="/auth/steam/callback" element={<SteamCallback />} />
                    <Route path="/esports" element={<OnboardingGuard><Esports /></OnboardingGuard>} />
                    <Route path="/esports/:gameId" element={<OnboardingGuard><Esports /></OnboardingGuard>} />
                    <Route path="/reviews" element={<OnboardingGuard><GameCatalog /></OnboardingGuard>} />
                    <Route path="/reviews/:gameId" element={<OnboardingGuard><GameReview /></OnboardingGuard>} />
                    <Route path="/battle-pass" element={<OnboardingGuard><BattlePass /></OnboardingGuard>} />
                    <Route path="/hub" element={<OnboardingGuard><Hub /></OnboardingGuard>} />
                    <Route path="/notifications" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                    <Route path="/guides" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                    <Route path="/hardware" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                    {/* Legal pages — public */}
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/cookies" element={<CookiePolicy />} />
                    <Route path="/guidelines" element={<ContentGuidelines />} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </AuthGateProvider>
        </XPProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
