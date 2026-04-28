import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUserProfile, type Profile } from "@/lib/profile";
import { useAuthGate } from "@/contexts/AuthGateContext";

export function UserProfileWidget() {
  const { isAuthenticated, user } = useAuthGate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      getCurrentUserProfile().then((p) => {
        if (p) setProfile(p);
      });
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="bg-card rounded-lg border card-shadow overflow-hidden relative group">
      {/* Banner Image */}
      <div className="h-16 w-full bg-secondary overflow-hidden relative">
        {profile?.banner_url ? (
          <img 
            src={profile.banner_url} 
            alt="Profile Banner" 
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-accent/20" />
        )}
      </div>

      <div className="px-4 pb-4 relative">
        {/* Profile Avatar */}
        <div className="absolute -top-6 left-4 border-2 border-card rounded-full overflow-hidden w-12 h-12 bg-secondary">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.username || "User"} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
              {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="pt-8">
          <Link to="/profile" className="block hover:underline">
            <h3 className="font-bold text-sm text-foreground truncate">
              {profile?.username || "Player One"}
            </h3>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {profile?.bio || "No bio set. Update your profile to add a bio!"}
          </p>
        </div>
      </div>
    </div>
  );
}
