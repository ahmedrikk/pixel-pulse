import { useAuthGate } from "@/contexts/AuthGateContext";
import { GatedAction } from "@/types/feed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chrome, MessageCircle, Loader2 } from "lucide-react";
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
};

const ACTION_SUBMESSAGES: Record<GatedAction, string> = {
  like: "Show appreciation for content you enjoy",
  comment: "Share your thoughts with the community",
  bookmark: "Build your personal reading list",
  share_profile: "Let others know what you're reading",
  share_feed: "Share articles with your followers",
  review: "Help others discover great games",
  react: "Express yourself with emoji reactions",
};

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    authModalContext,
  } = useAuthGate();
  
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/pixel-pulse/`,
        },
      });
      
      if (error) {
        toast.error("Google login failed", {
          description: error.message,
        });
      }
    } catch (err) {
      toast.error("Something went wrong");
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  };

  const handleDiscordLogin = async () => {
    setIsLoading("discord");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/pixel-pulse/`,
        },
      });
      
      if (error) {
        toast.error("Discord login failed", {
          description: error.message,
        });
      }
    } catch (err) {
      toast.error("Something went wrong");
      console.error(err);
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full h-11 font-semibold"
              onClick={handleGoogleLogin}
              disabled={isLoading !== null}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Free Account"}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading !== null}
            >
              Already have an account? Log In
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
