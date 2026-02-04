import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface TagFilterContextType {
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  clearFilter: () => void;
}

const TagFilterContext = createContext<TagFilterContextType | undefined>(undefined);

export function TagFilterProvider({ children }: { children: ReactNode }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const clearFilter = useCallback(() => {
    setActiveTag(null);
  }, []);

  return (
    <TagFilterContext.Provider value={{ activeTag, setActiveTag, clearFilter }}>
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
