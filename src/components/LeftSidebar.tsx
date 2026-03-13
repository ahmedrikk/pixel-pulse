import { Home, Star, Trophy, Swords, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "@/data/mockNews";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { UserProfileCard } from "@/components/UserProfileCard";
import { XPProgressBar } from "@/components/XPProgressBar";
import { useXP } from "@/contexts/XPContext";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
];

export function LeftSidebar() {
  const { state } = useXP();
  const bpProgress = (state.currentLevelXP / state.xpForNextLevel) * 100;
  const { activeTag, setActiveTag } = useTagFilter();

  const handleTagClick = (tagId: string) => {
    if (activeTag === tagId) {
      setActiveTag(null);
    } else {
      setActiveTag(tagId);
    }
  };

  return (
    <aside className="w-full lg:w-64 space-y-4">
      {/* User Profile Card */}
      <UserProfileCard />

      {/* Main Navigation */}
      <nav className="bg-card rounded-lg border card-shadow overflow-hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-foreground hover:text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}

        {/* XP Progress Bar inside nav card */}
        <div className="px-4 py-3 border-t border-border">
          <XPProgressBar />
        </div>
      </nav>

      {/* Battle Pass Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Battle Pass</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <span className="text-base font-black text-primary">{state.level}</span>
            </div>
            <div>
              <p className="text-sm font-bold">Level {state.level}</p>
              <p className="text-xs text-muted-foreground">Season of the Seraph</p>
            </div>
          </div>
          <div className="relative h-2 w-full rounded-full bg-secondary/60 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${bpProgress}%`,
                background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {state.currentLevelXP} / {state.xpForNextLevel} XP
          </p>
          <Button asChild variant="secondary" className="w-full gap-2 text-xs">
            <Link to="/battle-pass">
              Explore Battle Pass
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Category Tags */}
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
          Browse by Category
        </h4>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleTagClick(cat.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTag === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-tag text-tag-foreground hover:opacity-80"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
