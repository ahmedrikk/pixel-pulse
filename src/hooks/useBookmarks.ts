import { useState, useCallback, useEffect } from "react";
import { Article, Bookmark } from "@/types/feed";

const BOOKMARKS_STORAGE_KEY = "gamepulse_bookmarks";

export function useBookmarks(userId?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load bookmarks from localStorage (guest) or server (authenticated)
  useEffect(() => {
    const loadBookmarks = () => {
      try {
        const stored = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setBookmarks(parsed);
        }
      } catch (e) {
        console.error("Failed to load bookmarks", e);
      }
      setIsLoaded(true);
    };

    loadBookmarks();
  }, []);

  // Save bookmarks to localStorage
  const saveBookmarks = useCallback((newBookmarks: Bookmark[]) => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(newBookmarks));
    } catch (e) {
      console.error("Failed to save bookmarks", e);
    }
  }, []);

  // Check if article is bookmarked
  const isBookmarked = useCallback((articleId: string) => {
    return bookmarks.some(b => b.articleId === articleId);
  }, [bookmarks]);

  // Toggle bookmark
  const toggleBookmark = useCallback((article: Article) => {
    const isCurrentlyBookmarked = isBookmarked(article.id);
    
    let newBookmarks: Bookmark[];
    if (isCurrentlyBookmarked) {
      newBookmarks = bookmarks.filter(b => b.articleId !== article.id);
    } else {
      const newBookmark: Bookmark = {
        id: `bookmark-${Date.now()}`,
        userId: userId || "guest",
        articleId: article.id,
        savedAt: new Date().toISOString(),
        article,
      };
      newBookmarks = [newBookmark, ...bookmarks];
    }
    
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
    
    return !isCurrentlyBookmarked; // Returns true if now bookmarked
  }, [bookmarks, isBookmarked, saveBookmarks, userId]);

  // Remove bookmark
  const removeBookmark = useCallback((bookmarkId: string) => {
    const newBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);

  // Get bookmarks filtered by game tag
  const getBookmarksByTag = useCallback((tag: string) => {
    return bookmarks.filter(b => 
      b.article?.gameTags.includes(tag) || b.article?.topicTags.includes(tag)
    );
  }, [bookmarks]);

  // Get bookmarks sorted by date
  const sortedBookmarks = bookmarks.sort((a, b) => 
    new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  return {
    bookmarks: sortedBookmarks,
    isLoaded,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    getBookmarksByTag,
    bookmarkCount: bookmarks.length,
  };
}
