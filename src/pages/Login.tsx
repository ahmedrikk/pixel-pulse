import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, UserPlus, LogIn, Loader2, WifiOff, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase, enableDemoMode, checkSupabaseConnection } from "@/integrations/supabase/client";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");

  // Check connection on mount
  useEffect(() => {
    checkSupabaseConnection().then(isConnected => {
      setIsOffline(!isConnected);
      setCheckingConnection(false);
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          setIsOffline(true);
          setError("Cannot connect to server. Try demo mode below.");
        } else {
          setError(error.message);
        }
      } else {
        navigate("/profile");
      }
    } catch (err) {
      setIsOffline(true);
      setError("Network error. The server may be temporarily unavailable.");
    }
    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: { username: signupUsername },
        },
      });

      if (error) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          setIsOffline(true);
          setError("Cannot connect to server. Try demo mode below.");
        } else {
          setError(error.message);
        }
      } else {
        navigate("/profile");
      }
    } catch (err) {
      setIsOffline(true);
      setError("Network error. The server may be temporarily unavailable.");
    }
    setLoading(false);
  }

  function handleDemoMode() {
    enableDemoMode();
    navigate("/profile");
  }

  return (
    <div className="container max-w-md mx-auto py-12 px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Pixel Pulse</CardTitle>
          <CardDescription>Sign in to manage your profile and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Offline Warning */}
          {(isOffline || error?.includes('Network')) && (
            <Alert className="mb-4 bg-amber-500/10 border-amber-500/30">
              <WifiOff className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-sm">
                <p className="font-medium text-amber-600">Server Unavailable</p>
                <p className="text-muted-foreground">
                  Your Supabase project may be paused. You can still try the app in Demo Mode.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Demo Mode Button */}
          {(isOffline || checkingConnection) && (
            <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <Gamepad2 className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-bold">Try Demo Mode</h3>
                  <p className="text-xs text-muted-foreground">
                    Experience all features without an account
                  </p>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground mb-3 space-y-1">
                <li>✓ Tier 12 with 12,500 XP</li>
                <li>✓ 7-day login streak</li>
                <li>✓ All Battle Pass features</li>
                <li>✓ XP tracking simulation</li>
              </ul>
              <Button 
                onClick={handleDemoMode} 
                className="w-full"
                variant="secondary"
              >
                <Gamepad2 className="h-4 w-4 mr-2" />
                Enter Demo Mode
              </Button>
            </div>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {error && !error.includes('Network') && (
              <div className="mt-4 p-3 text-sm bg-destructive/10 text-destructive rounded-md">
                {error}
              </div>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isOffline}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isOffline}
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || isOffline}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4 mr-2" />
                  )}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="gamingpro123"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isOffline}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isOffline}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                      disabled={isOffline}
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || isOffline}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Help Text */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Having trouble?</p>
            <p>Your Supabase project may be paused due to inactivity.</p>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Go to Supabase Dashboard →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
