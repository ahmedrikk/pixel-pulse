import { Home, Star, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "@/data/mockNews";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { UserProfileCard } from "@/components/UserProfileCard";
import { XPProgressBar } from "@/components/XPProgressBar";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
];

export function LeftSidebar() {
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
