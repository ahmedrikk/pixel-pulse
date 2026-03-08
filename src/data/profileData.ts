export interface UserProfile {
  displayName: string;
  gamerTag: string;
  avatar: string;
  bio: string;
  bannerImage: string;
  following: number;
  followers: number;
  level: number;
  xp: number;
  maxXp: number;
  joinDate: string;
  platforms: string[];
  topGames: {
    id: string;
    name: string;
    coverImage: string;
    hoursPlayed: number;
  }[];
  recentReviews: {
    gameId: string;
    gameName: string;
    gameImage: string;
    rating: number;
    excerpt: string;
    date: string;
    likes: number;
  }[];
  achievements: {
    icon: string;
    label: string;
    description: string;
  }[];
}

export const MOCK_PROFILE: UserProfile = {
  displayName: "Ghost Titan",
  gamerTag: "GH0ST_T1T4N",
  avatar: "GT",
  bio: "Competitive FPS player & RPG completionist. Streaming daily on Twitch. Always hunting for the next challenge.",
  bannerImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1400&q=80",
  following: 342,
  followers: 12480,
  level: 47,
  xp: 7200,
  maxXp: 10000,
  joinDate: "March 2022",
  platforms: ["PC", "PS5", "Xbox"],
  topGames: [
    {
      id: "elden-ring-dlc",
      name: "Elden Ring",
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
      hoursPlayed: 486,
    },
    {
      id: "valorant-2",
      name: "Valorant",
      coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80",
      hoursPlayed: 1230,
    },
    {
      id: "monster-hunter-wilds",
      name: "Monster Hunter Wilds",
      coverImage: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&q=80",
      hoursPlayed: 312,
    },
  ],
  recentReviews: [
    {
      gameId: "elden-ring-dlc",
      gameName: "Elden Ring: Shadow of the Erdtree",
      gameImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
      rating: 5,
      excerpt: "FromSoftware's masterclass in DLC design. The Land of Shadow is breathtaking and the bosses are peak Souls difficulty.",
      date: "2024-07-15",
      likes: 234,
    },
    {
      gameId: "silent-hill-2",
      gameName: "Silent Hill 2 Remake",
      gameImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80",
      rating: 4,
      excerpt: "Bloober Team nailed the atmosphere. A few pacing issues aside, this is how you remake a classic.",
      date: "2024-10-22",
      likes: 156,
    },
    {
      gameId: "monster-hunter-wilds",
      gameName: "Monster Hunter Wilds",
      gameImage: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=400&q=80",
      rating: 5,
      excerpt: "The seamless open zones change everything. Best Monster Hunter entry to date, and the co-op is flawless.",
      date: "2025-02-28",
      likes: 89,
    },
    {
      gameId: "cs2-s2",
      gameName: "Counter-Strike 2: Season 2",
      gameImage: "https://images.unsplash.com/photo-1552820728-8b83bb6b2b28?w=400&q=80",
      rating: 3,
      excerpt: "Solid update but still feels like CS:GO with a fresh coat of paint. New smoke physics are cool though.",
      date: "2025-03-05",
      likes: 42,
    },
  ],
  achievements: [
    { icon: "🏆", label: "Elite Reviewer", description: "50+ reviews posted" },
    { icon: "🔥", label: "Streak Master", description: "30-day login streak" },
    { icon: "⭐", label: "Trusted Voice", description: "1000+ helpful votes" },
    { icon: "🎯", label: "Completionist", description: "100% in 10+ games" },
  ],
};
