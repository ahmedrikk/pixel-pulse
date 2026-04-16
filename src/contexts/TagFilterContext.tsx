import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface TagFilterContextType {
  activeTag: string | null;
  /** Human-readable category name (e.g. "PlayStation") matching the active tag slug */
  categoryName: string | null;
  setActiveTag: (tag: string | null) => void;
  setCategoryName: (name: string | null) => void;
  clearFilter: () => void;
}

const TagFilterContext = createContext<TagFilterContextType | undefined>(undefined);

export function TagFilterProvider({ children }: { children: ReactNode }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);

  const clearFilter = useCallback(() => {
    setActiveTag(null);
    setCategoryName(null);
  }, []);

  return (
    <TagFilterContext.Provider value={{ activeTag, categoryName, setActiveTag, setCategoryName, clearFilter }}>
      {children}
    </TagFilterContext.Provider>
  );
}

export function useTagFilter() {
  const context = useContext(TagFilterContext);
  if (context === undefined) {
    throw new Error("useTagFilter must be used within a TagFilterProvider");
  }
  return context;
}
