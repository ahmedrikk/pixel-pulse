import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { AuthGateProvider } from "@/contexts/AuthGateContext";
import { AuthGatePopup } from "@/components/AuthGatePopup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import SteamCallback from "./pages/SteamCallback";
import PublicProfile from "./pages/PublicProfile";
import DailyTrivia from "./pages/DailyTrivia";
import Leaderboard from "./pages/Leaderboard";
import Esports from "./pages/Esports";
import GameCatalog from "./pages/GameCatalog";
import GameReview from "./pages/GameReview";
import BattlePass from "./pages/BattlePass";
import Hub from "./pages/Hub";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import ContentGuidelines from "./pages/ContentGuidelines";

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
              <BrowserRouter basename={import.meta.env.BASE_URL}>
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
              </BrowserRouter>
            </TooltipProvider>
          </AuthGateProvider>
        </XPProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
