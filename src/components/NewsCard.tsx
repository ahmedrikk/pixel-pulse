import { ExternalLink, Share2, Bookmark, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsItem } from "@/data/mockNews";

interface NewsCardProps {
  news: NewsItem;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsCard({ news }: NewsCardProps) {
  return (
    <article className="bg-card rounded-lg border overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-200 group">
      {/* Cover Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={news.imageUrl}
          alt={news.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
          #{news.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{news.source}</span>
          <span>•</span>
          <span>{formatDate(news.timestamp)}</span>
          <span>•</span>
          <span>by {news.author}</span>
        </div>

        {/* Headline - AI Processed Title */}
        <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
          {news.title}
        </h2>

        {/* AI-Generated Summary - Full display, no truncation */}
        <p className="text-muted-foreground mb-4 leading-relaxed whitespace-normal break-words">
          {news.summary}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-primary">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">24</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <Button asChild size="sm" className="gap-2">
            <a href={news.sourceUrl} target="_blank" rel="noopener noreferrer">
              Read Full Article
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}
