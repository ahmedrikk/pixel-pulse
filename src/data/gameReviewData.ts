export interface GameReview {
  id: string;
  userName: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
  notHelpful: number;
  reviewCount: number;
}

export interface GameData {
  id: string;
  name: string;
  genre: string;
  developer: string;
  releaseDate: string;
  platforms: string[];
  heroImage: string;
  trailerUrl: string;
  averageRating: number;
  totalRatings: number;
  quickVerdict: string;
  description: string;
  scores: {
    gameplay: number;
    graphics: number;
    story: number;
    audio: number;
    replayability: number;
  };
  reviews: GameReview[];
}

export const FEATURED_GAME: GameData = {
  id: "elden-ring-dlc",
  name: "Elden Ring: Shadow of the Erdtree",
  genre: "Action RPG • Soulslike",
  developer: "FromSoftware",
  releaseDate: "June 21, 2024",
  platforms: ["PC", "PS5", "Xbox"],
  heroImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80",
  trailerUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  averageRating: 4.7,
  totalRatings: 12847,
  quickVerdict:
    "Shadow of the Erdtree is FromSoftware at its absolute peak. The DLC delivers a sprawling new landmass packed with punishing boss encounters, inventive weapons, and lore that deepens the Lands Between mythos. Minor camera issues in tight spaces and a steep difficulty curve for newcomers are the only blemishes on an otherwise masterful expansion.",
  description:
    "Step into the Land of Shadow, a vast new realm hidden behind the Scadutree. Players face entirely new enemy types, from spectral knights to grotesque flora-beasts, while mastering eight new weapon categories including the devastating Great Katana and the versatile Dueling Shields. The DLC introduces a separate leveling system via Scadutree Fragments, ensuring both veterans and newcomers face a calibrated challenge. Environmental storytelling reaches new heights — crumbling cathedrals, poisoned rivers, and eerie underground churches each tell a wordless tale. With over 40 hours of new content, multiple hidden areas, and ten main bosses that rank among the studio's best, Shadow of the Erdtree sets a new standard for DLC expansions.",
  scores: {
    gameplay: 5,
    graphics: 5,
    story: 4,
    audio: 5,
    replayability: 4,
  },
  reviews: [
    {
      id: "r1",
      userName: "DarkSoulsVet",
      avatar: "DS",
      rating: 5,
      text: "This DLC is a masterclass in game design. Every boss fight felt like a puzzle worth solving. The Land of Shadow is breathtaking and terrifying in equal measure. FromSoftware has outdone themselves.",
      date: "2024-07-15",
      helpful: 234,
      notHelpful: 12,
      reviewCount: 47,
    },
    {
      id: "r2",
      userName: "CasualGamer42",
      avatar: "CG",
      rating: 3,
      text: "Beautiful world and great combat, but the difficulty spike is brutal. I hit a wall at the third boss and spent 6 hours trying to beat it. Wish there were more accessibility options for players who just want to enjoy the story.",
      date: "2024-07-20",
      helpful: 189,
      notHelpful: 45,
      reviewCount: 12,
    },
    {
      id: "r3",
      userName: "LoreMaster_9000",
      avatar: "LM",
      rating: 5,
      text: "The lore implications are INSANE. Without spoilers, the way they connect Miquella's story to the base game completely recontextualizes everything. I've already done three playthroughs just to catch all the environmental details.",
      date: "2024-08-01",
      helpful: 312,
      notHelpful: 8,
      reviewCount: 89,
    },
    {
      id: "r4",
      userName: "SpeedRunner_X",
      avatar: "SR",
      rating: 4,
      text: "Great expansion with tons of content. The new weapons are incredibly fun to build around. Knocked off one star because some of the late-game bosses have input-reading that feels a bit unfair. Still, easily a 9/10 experience.",
      date: "2024-08-10",
      helpful: 156,
      notHelpful: 22,
      reviewCount: 63,
    },
    {
      id: "r5",
      userName: "PixelArtFan",
      avatar: "PA",
      rating: 5,
      text: "The art direction in this DLC is simply unmatched. Every area feels handcrafted with an attention to detail that puts most full games to shame. The Scadutree alone is worth the price of admission.",
      date: "2024-09-02",
      helpful: 98,
      notHelpful: 5,
      reviewCount: 31,
    },
  ],
};

export const TOP_REVIEWERS = [
  { name: "LoreMaster_9000", avatar: "LM", reviews: 89, helpful: 2840 },
  { name: "SpeedRunner_X", avatar: "SR", reviews: 63, helpful: 1920 },
  { name: "DarkSoulsVet", avatar: "DS", reviews: 47, helpful: 1560 },
  { name: "PixelArtFan", avatar: "PA", reviews: 31, helpful: 980 },
  { name: "CasualGamer42", avatar: "CG", reviews: 12, helpful: 420 },
];
