import { useAuthGate } from "@/contexts/AuthGateContext";
import { GatedAction } from "@/types/feed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chrome, MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_MESSAGES: Record<GatedAction, string> = {
  like: "Join to like this article",
  comment: "Join to join the discussion",
  bookmark: "Join to save articles for later",
  share_profile: "Join to share with your profile",
  share_feed: "Join to post to your feed",
  review: "Join to rate and review games",
  react: "Join to react to content",
  signup_prompt: "Join LevelUpXP",
};

const ACTION_SUBMESSAGES: Record<GatedAction, string> = {
  like: "Show appreciation for content you enjoy",
  comment: "Share your thoughts with the community",
  bookmark: "Build your personal reading list",
  share_profile: "Let others know what you're reading",
  share_feed: "Share articles with your followers",
  review: "Help others discover great games",
  react: "Express yourself with emoji reactions",
  signup_prompt: "Post reviews, track favorites & unlock achievements 🎮",
};

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    authModalContext,
  } = useAuthGate();
  
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getRedirectUrl = () => {
    // For GitHub Pages, we need to handle the redirect properly
    const baseUrl = window.location.origin;
    const pathname = window.location.pathname;
    
    // If we're on GitHub Pages with /pixel-pulse/ path
    if (pathname.includes('/pixel-pulse/')) {
      return `${baseUrl}/pixel-pulse/`;
    }
    
    return baseUrl + '/';
  };

  const handleGoogleLogin = async () => {
    setIsLoading("google");
    setError(null);
    
    try {
      const redirectTo = getRedirectUrl();
      console.log("Google OAuth redirectTo:", redirectTo);
      
      const { error: oauthError, data } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (oauthError) {
        console.error("Google OAuth error:", oauthError);
        setError(oauthError.message);
        toast.error("Google login failed", {
          description: oauthError.message,
        });
      } else {
        console.log("Google OAuth initiated:", data);
        // The OAuth flow will redirect the user, so we don't need to do anything else
      }
    } catch (err) {
      console.error("Unexpected error during Google login:", err);
      setError("An unexpected error occurred");
      toast.error("Something went wrong");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDiscordLogin = async () => {
    setIsLoading("discord");
    setError(null);
    
    try {
      const redirectTo = getRedirectUrl();
      console.log("Discord OAuth redirectTo:", redirectTo);
      
      const { error: oauthError, data } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo,
        },
      });
      
      if (oauthError) {
        console.error("Discord OAuth error:", oauthError);
        setError(oauthError.message);
        toast.error("Discord login failed", {
          description: oauthError.message,
        });
      } else {
        console.log("Discord OAuth initiated:", data);
      }
    } catch (err) {
      console.error("Unexpected error during Discord login:", err);
      setError("An unexpected error occurred");
      toast.error("Something went wrong");
    } finally {
      setIsLoading(null);
    }
  };

  const title = authModalContext ? ACTION_MESSAGES[authModalContext] : "Join Game Pulse";
  const subMessage = authModalContext ? ACTION_SUBMESSAGES[authModalContext] : "Create an account to unlock all features";

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <p className="text-center text-muted-foreground text-sm">
            {subMessage}
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Social Login Options */}
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full gap-2 h-11"
              onClick={handleGoogleLogin}
              disabled={isLoading !== null}
            >
              {isLoading === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="h-5 w-5 text-red-500" />
              )}
              Continue with Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2 h-11"
              onClick={handleDiscordLogin}
              disabled={isLoading !== null}
            >
              {isLoading === "discord" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <MessageCircle className="h-5 w-5 text-indigo-500" />
              )}
              Continue with Discord
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By joining, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
