import { useNavigate, useSearchParams } from "react-router-dom";
import { useTagFilter } from "@/contexts/TagFilterContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  name: string;
  slug: string;
  articleCount: number;
  isTrending: boolean;
}

interface CategoryPillsWidgetProps {
  categories?: Category[];
}

// ─── Static mock data (matches spec Section 3.7) ──────────────────────────────

const TOP_CATEGORIES: Category[] = [
  { name: "PlayStation", slug: "PlayStation",  articleCount: 142, isTrending: true },
  { name: "GTA 6",       slug: "GTA6",         articleCount: 98,  isTrending: true },
  { name: "Esports",     slug: "Esports",      articleCount: 79,  isTrending: true },
  { name: "PC Gaming",   slug: "PCGaming",     articleCount: 118, isTrending: false },
  { name: "FPS",         slug: "FPS",          articleCount: 95,  isTrending: false },
  { name: "RPG",         slug: "RPG",          articleCount: 88,  isTrending: false },
  { name: "Nintendo",    slug: "Nintendo",     articleCount: 76,  isTrending: false },
  { name: "Xbox",        slug: "Xbox",         articleCount: 65,  isTrending: false },
  { name: "Indie Games", slug: "Indie",        articleCount: 58,  isTrending: false },
  { name: "Streaming",   slug: "Streaming",    articleCount: 51,  isTrending: false },
];

// ─── Pill Component ───────────────────────────────────────────────────────────

interface PillProps {
  category: Category;
  isActive: boolean;
  onClick: () => void;
}

function Pill({ category, isActive, onClick }: PillProps) {
  const { isTrending } = category;

  // Token-based, theme-aware pill styling (purple-forward brand).
  const base =
    "inline-flex items-center gap-1 px-2.5 py-[5px] rounded-full text-[11px] cursor-pointer select-none transition-all border";
  const variant = isActive
    ? "bg-primary text-primary-foreground border-primary font-medium hover:opacity-90"
    : isTrending
    ? "bg-primary/[0.08] text-primary border-primary/30 hover:bg-primary/15 hover:border-primary/50"
    : "bg-transparent text-muted-foreground border-border hover:bg-primary/[0.08] hover:text-primary hover:border-primary/40";

  return (
    <button id={`cat-pill-${category.slug}`} onClick={onClick} className={`${base} ${variant}`}>
      {/* Trending fire emoji */}
      {isTrending && <span className="text-[9px]">🔥</span>}

      {/* Category name */}
      <span>{category.name}</span>

      {/* Article count */}
      <span className="text-[9px] opacity-60">{category.articleCount}</span>

      {/* Active × */}
      {isActive && <span className="text-[10px] ml-[3px]">×</span>}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CategoryPillsWidget({
  categories = TOP_CATEGORIES,
}: CategoryPillsWidgetProps) {
  const { activeTag, setActiveTag, setCategoryName } = useTagFilter();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // Trending pills first (spec 3.3)
  const sorted = [
    ...categories.filter((c) => c.isTrending),
    ...categories.filter((c) => !c.isTrending),
  ];

  const handlePillClick = (cat: Category) => {
    if (activeTag === cat.slug) {
      // Clear filter
      setActiveTag(null);
      setCategoryName(null);
      navigate("/", { replace: true });
    } else {
      setActiveTag(cat.slug);
      setCategoryName(cat.name);
      setSearchParams({ category: cat.slug }, { replace: true });
    }
  };

  return (
    <div className="bg-card border rounded-xl p-3.5 card-shadow">
      {/* Header */}
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs font-semibold text-foreground">Browse by category</span>
        <span className="text-[10px] text-muted-foreground">Top 10</span>
      </div>

      {/* Pill wrap */}
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((cat) => (
          <Pill
            key={cat.slug}
            category={cat}
            isActive={activeTag === cat.slug}
            onClick={() => handlePillClick(cat)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Mobile horizontal scroll variant ────────────────────────────────────────

export function MobileCategoryScroll({
  categories = TOP_CATEGORIES,
}: CategoryPillsWidgetProps) {
  const { activeTag, setActiveTag, setCategoryName } = useTagFilter();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const sorted = [
    ...categories.filter((c) => c.isTrending),
    ...categories.filter((c) => !c.isTrending),
  ];

  const handlePillClick = (cat: Category) => {
    if (activeTag === cat.slug) {
      setActiveTag(null);
      setCategoryName(null);
      navigate("/", { replace: true });
    } else {
      setActiveTag(cat.slug);
      setCategoryName(cat.name);
      setSearchParams({ category: cat.slug }, { replace: true });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: "0 0 8px 0",
        msOverflowStyle: "none",
      }}
      // Hide webkit scrollbar via className below
      className="mobile-cat-scroll"
    >
      {sorted.map((cat) => (
        <Pill
          key={cat.slug}
          category={cat}
          isActive={activeTag === cat.slug}
          onClick={() => handlePillClick(cat)}
        />
      ))}
    </div>
  );
}
