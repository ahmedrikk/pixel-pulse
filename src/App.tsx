import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import Index from "./pages/Index";
import Esports from "./pages/Esports";
import GameCatalog from "./pages/GameCatalog";
import GameReview from "./pages/GameReview";
import BattlePass from "./pages/BattlePass";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <XPProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/esports" element={<Esports />} />
              <Route path="/esports/:gameId" element={<Esports />} />
              <Route path="/reviews" element={<GameCatalog />} />
              <Route path="/reviews/:gameId" element={<GameReview />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </XPProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
