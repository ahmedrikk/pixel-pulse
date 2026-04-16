import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import Step1Identity from "./pages/onboarding/Step1Identity";
import Step2Platforms from "./pages/onboarding/Step2Platforms";
import Step3Games from "./pages/onboarding/Step3Games";
import Step4Confirmation from "./pages/onboarding/Step4Confirmation";

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
                  <Route path="/onboarding/step-1" element={<Step1Identity />} />
                  <Route path="/onboarding/step-2" element={<Step2Platforms />} />
                  <Route path="/onboarding/step-3" element={<Step3Games />} />
                  <Route path="/onboarding/step-4" element={<Step4Confirmation />} />

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
                  <Route path="/notifications" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                  <Route path="/guides" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                  <Route path="/hardware" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
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
