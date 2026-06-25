export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl: string;
  category: string;
  timestamp: string;
  source: string;
  author: string;
  tags: string[];
  gameTags?: string[];
  likes?: number;
  comments?: number;
  fetchedAt?: string;
}

// Genre/category labels used by the onboarding + preference pickers.
export const CATEGORIES = [
  { id: "FPS", label: "#FPS", icon: "🎯" },
  { id: "RPG", label: "#RPG", icon: "⚔️" },
  { id: "Indie", label: "#Indie", icon: "🎮" },
  { id: "PlayStation", label: "#PlayStation", icon: "🎵" },
  { id: "Xbox", label: "#Xbox", icon: "❎" },
  { id: "PCGaming", label: "#PCGaming", icon: "🖥️" },
  { id: "Nintendo", label: "#Nintendo", icon: "🍄" },
  { id: "Twitch", label: "#Twitch", icon: "📺" },
  { id: "YouTube", label: "#YouTube", icon: "▶️" },
  { id: "Streamers", label: "#Streamers", icon: "🎙️" },
  { id: "Esports", label: "#Esports", icon: "🏆" },
];
