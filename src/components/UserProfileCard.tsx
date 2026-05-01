import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  nameplate_url: string | null;
  about_me: string | null;
}

const DEFAULT_BANNER = "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=200&fit=crop";

export function UserProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setIsLoggedIn(true);
      supabase
        .from("profiles")
        .select("username, avatar_url, banner_url, nameplate_url, about_me")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setProfile(data));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
      if (!session?.user) setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="bg-card rounded-2xl border p-4 card-shadow text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl mx-auto">
          🎮
        </div>
        <p className="text-sm text-muted-foreground">Sign in to track your XP and stats</p>
        <Link to="/login">
          <Button className="w-full" size="sm">Sign In</Button>
        </Link>
      </div>
    );
  }

  const displayName = profile?.username ?? "Gamer";
  const initials = displayName.slice(0, 2).toUpperCase();
  const bannerUrl = profile?.banner_url ?? DEFAULT_BANNER;

  return (
    <motion.div
      className="bg-card rounded-2xl border overflow-hidden card-shadow cursor-pointer"
      whileHover={{ scale: 1.02, boxShadow: "0 8px 30px -10px hsl(var(--foreground) / 0.12)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        <img
          src={bannerUrl}
          alt="Profile banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/30" />

        {/* Avatar overlapping banner */}
        <div className="absolute -bottom-8 left-5">
          <motion.div
            animate={isHovered ? { scale: 1.08 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Avatar src={profile?.avatar_url ?? undefined} fallback={displayName} frameUrl={profile?.nameplate_url ?? undefined} size="lg" />
          </motion.div>
        </div>

        {/* Name on banner */}
        <div className="absolute bottom-1 left-24">
          <p className="text-sm font-bold text-foreground drop-shadow-sm leading-tight">
            @{displayName}
          </p>
        </div>
      </div>

      {/* Bio */}
      <div className="pt-10 px-5 pb-4">
        {profile?.about_me ? (
          <p className="text-sm text-foreground leading-relaxed">{profile.about_me}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No bio yet</p>
        )}

        {/* Profile link */}
        <div className="mt-4 pt-3 border-t border-border">
          <Link to="/profile">
            <Button size="sm" variant="secondary" className="w-full">View Profile</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
