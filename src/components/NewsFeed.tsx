import { INITIAL_NEWS } from "@/data/mockNews";
import { NewsCard } from "./NewsCard";

export function NewsFeed() {
  return (
    <main className="flex-1 space-y-4">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Latest Gaming News</h1>
        <select className="bg-secondary text-foreground text-sm px-3 py-1.5 rounded-md border-0 focus:ring-2 focus:ring-primary">
          <option>Most Recent</option>
          <option>Most Popular</option>
          <option>Trending</option>
        </select>
      </div>

      {/* News Cards */}
      <div className="space-y-4">
        {INITIAL_NEWS.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      {/* Load More */}
      <div className="text-center py-6">
        <button className="text-primary font-medium hover:underline">
          Load more articles...
        </button>
      </div>
    </main>
  );
}
