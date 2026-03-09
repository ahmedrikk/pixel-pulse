// Feed Types for Game Pulse News System

export interface Article {
  id: string;
  title: string;
  summary: string;
  summaryWordCount: number;
  sourceName: string;
  sourceUrl: string;
  sourceLogo?: string;
  author: string;
  heroImageUrl: string;
  gameTags: string[];
  topicTags: string[];
  publishedAt: string;
  fetchedAt: string;
  engagementScore: number;
  likes: number;
  comments: number;
  reactions: Record<string, number>;
}

export interface UserImpression {
  id: string;
  userId: string;
  articleId: string;
  seenAt: string;
  readFull: boolean;
  dwellSeconds: number;
}

export interface UserFavGame {
  id: string;
  userId: string;
  gameId: string;
  addedAt: string;
}

export interface FeedSession {
  id: string;
  userId: string;
  sessionStart: string;
  lastFeedLoadAt: string;
  lastArticleIdSeen: string;
}

// Feed Priority Types
export type FeedPriority = "personalized" | "unseen" | "trending" | "fallback";

export interface RankedArticle extends Article {
  priority: FeedPriority;
  priorityScore: number;
  isNew?: boolean;
}

// Comment Types (Reddit-style)
export interface Comment {
  id: string;
  articleId: string;
  userId: string;
  parentCommentId: string | null;
  body: string;
  depth: number;
  upvotes: number;
  downvotes: number;
  score: number;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: {
    name: string;
    avatar?: string;
    tier?: number;
  };
  userVote?: "up" | "down" | null;
  replies?: Comment[];
}

export interface CommentVote {
  id: string;
  userId: string;
  commentId: string;
  voteType: "up" | "down";
  createdAt: string;
}

// Game Review Types
export interface GameReview {
  id: string;
  userId: string;
  gameId: string;
  starRating: number;
  reviewText: string | null;
  tags: string[];
  helpfulVotes: number;
  createdAt: string;
  source: "feed_prompt" | "game_page";
}

export interface Game {
  id: string;
  name: string;
  coverImageUrl: string;
  genre: string[];
  developer: string;
  avgRating: number;
  reviewCount: number;
  lastReviewedAt: string;
}

export interface UserReviewPrompt {
  id: string;
  userId: string;
  gameId: string;
  shownAt: string;
  dismissedAt: string | null;
  dismissedCount: number;
  permanentlySkipped: boolean;
}

// Bookmark Types
export interface Bookmark {
  id: string;
  userId: string;
  articleId: string;
  savedAt: string;
  article?: Article;
}

// Auth Gate Types
export type GatedAction = "like" | "comment" | "bookmark" | "share_profile" | "share_feed" | "review" | "react";

export interface PendingAction {
  type: GatedAction;
  articleId?: string;
  commentId?: string;
  gameId?: string;
  data?: Record<string, unknown>;
}

// Feed Config
export interface FeedConfig {
  scrollThreshold: number; // viewport heights
  viewThreshold: number; // cards viewed
  timeThreshold: number; // seconds
  pageSize: number;
}

export const DEFAULT_FEED_CONFIG: FeedConfig = {
  scrollThreshold: 3,
  viewThreshold: 6,
  timeThreshold: 90,
  pageSize: 15,
};

// XP Constants - aligned with XPContext
export const XP_VALUES = {
  VIEW_SUMMARY: 20,
  READ_FULL_ARTICLE: 35,
  REACT: 10,
  COMMENT: 25,
  SCROLL_DEPTH: 5,
  REVIEW_WITH_TEXT: 75,
  REVIEW_RATING_ONLY: 30,
  REVIEW_HELPFUL_VOTES: 25,
};

// Comment Constants
export const COMMENT_CONSTANTS = {
  MAX_DEPTH: 3,
  MIN_LENGTH: 20,
  MAX_LENGTH: 2000,
  EDIT_WINDOW_MINUTES: 15,
  COOLDOWN_SECONDS: 60,
  DAILY_CAP: 5,
  UPVOTE_BONUS_THRESHOLD: 5,
  UPVOTE_BONUS_XP: 20,
};
