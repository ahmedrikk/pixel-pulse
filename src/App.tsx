import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import { XPGainOverlay } from "./components/XPGainOverlay";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <XPGainOverlay />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/trivia" element={<DailyTrivia />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/auth/steam/callback" element={<SteamCallback />} />
            <Route path="/esports" element={<Esports />} />
            <Route path="/reviews" element={<GameCatalog />} />
            <Route path="/reviews/:gameId" element={<GameReview />} />
            <Route path="/guides" element={<ComingSoon />} />
            <Route path="/hardware" element={<ComingSoon />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
