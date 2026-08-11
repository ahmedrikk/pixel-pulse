import { Bell, Home, Trophy, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { requestHomeFeedRefresh } from "@/lib/refreshFeed";

const PRIMARY_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
];

export function BottomNavBar() {
  const { pathname } = useLocation();
  const { user, isAuthenticated, openAuthModal } = useAuthGate();
  const { profile } = useProfile();
  const { data: notifications = [] } = useNotifications(user?.id);
  const unread = notifications.filter((item) => !item.readAt).length;
  const profileActive = pathname.startsWith("/profile") || pathname.startsWith("/settings");
  const profileLabel = profile?.display_name || profile?.username || user?.user_metadata?.display_name || user?.user_metadata?.name || "Profile";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = profileLabel.slice(0, 2).toUpperCase();

  return (
    <nav aria-label="Primary mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              to={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => {
                if (item.href === "/" && pathname === "/") {
                  event.preventDefault();
                  requestHomeFeedRefresh();
                }
              }}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors",
                isActive && "text-primary",
              )}
            >
              <span className={cn("relative rounded-full p-1", isActive && "bg-primary/10")}>
                <item.icon className="h-5 w-5" />
                {item.href === "/notifications" && unread > 0 && (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-tiny-label font-bold leading-4 text-destructive-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-1 text-tiny-label leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {isAuthenticated ? (
          <Link
            to="/profile"
            aria-current={profileActive ? "page" : undefined}
            aria-label="Profile"
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors",
              profileActive && "text-primary",
            )}
          >
            <span className={cn("flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 bg-secondary text-tiny-label font-bold", profileActive ? "border-primary" : "border-border")}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : initials ? initials : <UserRound className="h-4 w-4" />}
            </span>
            <span className="text-tiny-label leading-tight">Profile</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal("signup_prompt")}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
            aria-label="Sign up or log in to open your profile"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-secondary">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-tiny-label leading-tight">Profile</span>
          </button>
        )}
      </div>
    </nav>
  );
}
