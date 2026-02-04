import { Home, Star, Trophy, BookOpen, Cpu } from "lucide-react";
import { CATEGORIES } from "@/data/mockNews";
import { useTagFilter } from "@/contexts/TagFilterContext";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: BookOpen, label: "Guides", href: "/guides" },
  { icon: Cpu, label: "Hardware", href: "/hardware" },
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
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
            GT
          </div>
          <div>
            <h3 className="font-semibold">GamerTag_X</h3>
            <p className="text-sm text-muted-foreground">@gamertag</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Indie game enthusiast & RPG lover. Always hunting for hidden gems. 🎮
        </p>
        <div className="flex gap-4 mt-3 text-sm">
          <span><strong>142</strong> <span className="text-muted-foreground">Following</span></span>
          <span><strong>891</strong> <span className="text-muted-foreground">Followers</span></span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="bg-card rounded-lg border card-shadow overflow-hidden">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-foreground hover:text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
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
