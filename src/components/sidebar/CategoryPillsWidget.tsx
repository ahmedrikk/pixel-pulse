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

  // Determine base styles
  const getStyle = (hovered: boolean): React.CSSProperties => {
    if (isActive) {
      return {
        background: "#EEEDFE",
        border: "0.5px solid #534AB7",
        color: "#534AB7",
        fontWeight: 500,
        opacity: hovered ? 0.85 : 1,
      };
    }
    if (isTrending) {
      return {
        background: hovered ? "rgba(22,163,74,0.12)" : "rgba(22,163,74,0.06)",
        border: `0.5px solid rgba(22,163,74,${hovered ? "0.5" : "0.35"})`,
        color: "#16A34A",
      };
    }
    return {
      background: "transparent",
      border: "0.5px solid var(--color-border-secondary, rgba(255,255,255,0.12))",
      color: "var(--color-text-secondary, hsl(var(--muted-foreground)))",
      ...(hovered
        ? {
            border: "0.5px solid #534AB7",
            color: "#534AB7",
            background: "#EEEDFE",
          }
        : {}),
    };
  };

  return (
    <button
      id={`cat-pill-${category.slug}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "5px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        cursor: "pointer",
        transition: "all 0.15s",
        userSelect: "none",
        ...getStyle(false),
      }}
      onMouseEnter={(e) => {
        Object.assign((e.currentTarget as HTMLButtonElement).style, getStyle(true));
      }}
      onMouseLeave={(e) => {
        Object.assign((e.currentTarget as HTMLButtonElement).style, getStyle(false));
      }}
    >
      {/* Trending fire emoji */}
      {isTrending && (
        <span style={{ fontSize: "9px" }}>🔥</span>
      )}

      {/* Category name */}
      <span>{category.name}</span>

      {/* Article count */}
      <span style={{ fontSize: "9px", opacity: 0.6 }}>{category.articleCount}</span>

      {/* Active × */}
      {isActive && (
        <span style={{ fontSize: "10px", marginLeft: "3px" }}>×</span>
      )}
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
    <div
      style={{
        background: "var(--color-background-primary, hsl(var(--card)))",
        border: "0.5px solid var(--color-border-tertiary, hsl(var(--border)))",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-primary, hsl(var(--foreground)))",
          }}
        >
          Browse by category
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-tertiary, hsl(var(--muted-foreground)))",
          }}
        >
          Top 10
        </span>
      </div>

      {/* Pill wrap */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
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
