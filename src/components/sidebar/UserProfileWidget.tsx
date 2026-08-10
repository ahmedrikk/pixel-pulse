import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useProfile } from "@/contexts/ProfileContext";
import { User, LogIn, UserCircle, Settings, UserPlus, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserProfileWidget() {
  const { isAuthenticated, user, openAuthModal, signOut } = useAuthGate();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setMenuOpen(false), 140);
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="group relative overflow-hidden rounded-xl border bg-card">
        {/* Banner Image */}
        <div className="h-20 w-full bg-secondary overflow-hidden relative">
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-accent/20" />
        </div>

        <div className="px-4 pb-4 relative">
          {/* Profile Avatar */}
          <div className="absolute -top-8 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-card bg-secondary shadow-sm">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Content */}
          <div className="pt-10">
            <button 
              onClick={() => openAuthModal('signup_prompt')}
              className="text-left hover:underline cursor-pointer"
            >
              <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                Guest User
                <LogIn className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
            </button>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Log in to personalize your feed, save preferences, and predict matches.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-xl border bg-card"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      {/* Banner Image */}
      <div className="h-20 w-full bg-secondary overflow-hidden relative">
        {profile?.banner_url ? (
          profile.banner_url.startsWith('linear-gradient') || profile.banner_url.startsWith('radial-gradient') ? (
            <div className="w-full h-full opacity-80" style={{ background: profile.banner_url }} />
          ) : (
            <img 
              src={profile.banner_url} 
              alt="Profile Banner" 
              className="w-full h-full object-cover opacity-80"
            />
          )
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-accent/20" />
        )}
      </div>

      <div className="px-4 pb-4 relative">
        {/* Profile Avatar */}
        <div className="absolute -top-8 left-4 h-16 w-16 overflow-hidden rounded-full border-[3px] border-card bg-secondary shadow-sm">
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
        <div className="pt-10">
          <h3 className="font-bold text-sm text-foreground truncate">
            {profile?.display_name || profile?.username || user.user_metadata?.display_name || "Player One"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {profile?.about_me || "No bio set. Update your profile to add a bio!"}
          </p>
        </div>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="absolute inset-0 z-10 rounded-xl outline-none ring-primary/30 focus-visible:ring-2"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          className="w-[220px] p-2"
          sideOffset={4}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-secondary/70 px-2 py-2">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-secondary">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="m-2 h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{profile?.display_name || profile?.username || "Player One"}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile?.username || "player"}</p>
            </div>
          </div>
          <DropdownMenuItem onSelect={() => navigate("/profile")} className="gap-3 rounded-lg py-2.5">
            <UserCircle className="h-4 w-4" /> Go to profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/settings/account")} className="gap-3 rounded-lg py-2.5">
            <Settings className="h-4 w-4" /> Account settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              await signOut();
              navigate("/login");
            }}
            className="gap-3 rounded-lg py-2.5"
          >
            <UserPlus className="h-4 w-4" /> Add another account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              await signOut();
              navigate("/");
            }}
            className="gap-3 rounded-lg py-2.5 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
