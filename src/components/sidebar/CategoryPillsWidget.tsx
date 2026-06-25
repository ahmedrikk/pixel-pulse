import { useNavigate, useSearchParams } from "react-router-dom";
import { useTrendingCategories, type TrendingCategory } from "@/hooks/useTrendingCategories";

// ─── Pill ───────────────────────────────────────────────────────────────────

interface PillProps {
  category: TrendingCategory;
  isActive: boolean;
  onClick: () => void;
}

function Pill({ category, isActive, onClick }: PillProps) {
  const { isTrending } = category;

  const base =
    "inline-flex items-center gap-1 px-2.5 py-[5px] rounded-full text-[11px] cursor-pointer select-none transition-all border";
  const variant = isActive
    ? "bg-primary text-primary-foreground border-primary font-medium hover:opacity-90"
    : isTrending
    ? "bg-primary/[0.08] text-primary border-primary/30 hover:bg-primary/15 hover:border-primary/50"
    : "bg-transparent text-muted-foreground border-border hover:bg-primary/[0.08] hover:text-primary hover:border-primary/40";

  return (
    <button onClick={onClick} className={`${base} ${variant}`}>
      {isTrending && <span className="text-[9px]">🔥</span>}
      <span>{category.name}</span>
      <span className="text-[9px] opacity-60">{category.count}</span>
      {isActive && <span className="text-[10px] ml-[3px]">×</span>}
    </button>
  );
}

// ─── Shared click behaviour ───────────────────────────────────────────────────
// Bluesky-style: selecting a category always takes you to the home feed
// filtered by it (and toggles off back to the full feed). Driven entirely by
// the ?category= URL param, so the widget works on any page without context.
function useCategoryNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSlug = searchParams.get("category");

  const onSelect = (slug: string) => {
    if (activeSlug === slug) navigate("/");
    else navigate(`/?category=${encodeURIComponent(slug)}`);
  };

  return { activeSlug, onSelect };
}

// ─── Sidebar widget ───────────────────────────────────────────────────────────

export function CategoryPillsWidget() {
  const { categories, isLoading } = useTrendingCategories(12);
  const { activeSlug, onSelect } = useCategoryNav();

  if (!isLoading && categories.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-3.5 card-shadow">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs font-semibold text-foreground">Browse by category</span>
        <span className="text-[10px] text-muted-foreground">Trending now</span>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[26px] w-16 rounded-full bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <Pill
              key={cat.slug}
              category={cat}
              isActive={activeSlug === cat.slug}
              onClick={() => onSelect(cat.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile horizontal scroll variant ────────────────────────────────────────

export function MobileCategoryScroll() {
  const { categories, isLoading } = useTrendingCategories(12);
  const { activeSlug, onSelect } = useCategoryNav();

  if (isLoading || categories.length === 0) return null;

  return (
    <div className="mobile-cat-scroll flex gap-1.5 overflow-x-auto pb-2">
      {categories.map((cat) => (
        <Pill
          key={cat.slug}
          category={cat}
          isActive={activeSlug === cat.slug}
          onClick={() => onSelect(cat.slug)}
        />
      ))}
    </div>
  );
}
