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

/* Full review data for each game in the catalog */
export const GAME_DATABASE: Record<string, GameData> = {
  "elden-ring-dlc": {
    id: "elden-ring-dlc",
    name: "Elden Ring: Shadow of the Erdtree",
    genre: "Action RPG · Soulslike",
    developer: "FromSoftware",
    releaseDate: "June 21, 2024",
    platforms: ["PC", "PS5", "Xbox"],
    heroImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/5sPKUWw2fWo",
    averageRating: 4.7,
    totalRatings: 12847,
    quickVerdict:
      "Shadow of the Erdtree is FromSoftware at its absolute peak. The DLC delivers a sprawling new landmass packed with punishing boss encounters, inventive weapons, and lore that deepens the Lands Between mythos.",
    description:
      "Step into the Land of Shadow, a vast new realm hidden behind the Scadutree. Players face entirely new enemy types, from spectral knights to grotesque flora-beasts, while mastering eight new weapon categories including the devastating Great Katana and the versatile Dueling Shields. With over 40 hours of new content, multiple hidden areas, and ten main bosses that rank among the studio's best, Shadow of the Erdtree sets a new standard for DLC expansions.",
    scores: { gameplay: 5, graphics: 5, story: 4, audio: 5, replayability: 4 },
    reviews: [
      { id: "r1", userName: "DarkSoulsVet", avatar: "DS", rating: 5, text: "This DLC is a masterclass in game design. Every boss fight felt like a puzzle worth solving. The Land of Shadow is breathtaking and terrifying in equal measure.", date: "2024-07-15", helpful: 234, notHelpful: 12, reviewCount: 47 },
      { id: "r2", userName: "CasualGamer42", avatar: "CG", rating: 3, text: "Beautiful world and great combat, but the difficulty spike is brutal. I hit a wall at the third boss and spent 6 hours trying to beat it.", date: "2024-07-20", helpful: 189, notHelpful: 45, reviewCount: 12 },
      { id: "r3", userName: "LoreMaster_9000", avatar: "LM", rating: 5, text: "The lore implications are INSANE. The way they connect Miquella's story to the base game completely recontextualizes everything.", date: "2024-08-01", helpful: 312, notHelpful: 8, reviewCount: 89 },
    ],
  },
  "gta-vi": {
    id: "gta-vi",
    name: "Grand Theft Auto VI",
    genre: "Action Adventure · Open World",
    developer: "Rockstar Games",
    releaseDate: "Fall 2025",
    platforms: ["PS5", "Xbox"],
    heroImage: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/QdBZY2fkU-0",
    averageRating: 4.9,
    totalRatings: 54210,
    quickVerdict:
      "Rockstar's most ambitious project redefines open-world gaming. Vice City has never looked or felt this alive, with unprecedented detail and a gripping dual-protagonist narrative.",
    description:
      "Return to Vice City in a reimagined, modern-day Florida-inspired setting. Play as Lucia and Jason in a Bonnie & Clyde-inspired story across the sprawling metropolis and surrounding countryside. Features the most detailed open world ever created, with dynamic weather, a living economy, and over 200 hours of content.",
    scores: { gameplay: 5, graphics: 5, story: 5, audio: 5, replayability: 5 },
    reviews: [
      { id: "r1", userName: "OpenWorldFan", avatar: "OW", rating: 5, text: "This is the new gold standard for open-world games. Every street corner tells a story. Rockstar has outdone themselves.", date: "2025-10-15", helpful: 456, notHelpful: 8, reviewCount: 34 },
      { id: "r2", userName: "StoryDriven", avatar: "SD", rating: 5, text: "Lucia is one of the best protagonists in gaming history. The dual-character dynamic adds so much depth to the narrative.", date: "2025-10-20", helpful: 389, notHelpful: 12, reviewCount: 56 },
    ],
  },
  "valorant-2": {
    id: "valorant-2",
    name: "Valorant: Episode 9",
    genre: "FPS · Tactical Shooter",
    developer: "Riot Games",
    releaseDate: "Jan 2025",
    platforms: ["PC"],
    heroImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/e_E9W2vsRGs",
    averageRating: 4.3,
    totalRatings: 31520,
    quickVerdict:
      "Episode 9 brings the most significant meta shift since launch. New agents and maps reinvigorate the competitive scene, though balance adjustments are still needed.",
    description:
      "The latest episode introduces three new agents, two competitive maps, and a completely revamped ranking system. The new Premier mode expansion makes organized team play more accessible than ever, while custom game improvements give content creators new tools.",
    scores: { gameplay: 5, graphics: 4, story: 3, audio: 4, replayability: 5 },
    reviews: [
      { id: "r1", userName: "TacticalAce", avatar: "TA", rating: 5, text: "Best episode yet. The new agent synergies open up so many team compositions. Competitive has never been more fun.", date: "2025-02-10", helpful: 198, notHelpful: 22, reviewCount: 78 },
      { id: "r2", userName: "CasualPlayer", avatar: "CP", rating: 3, text: "Fun but the new agent feels overtuned. Ranked is a coinflip right now depending on who picks them first.", date: "2025-02-15", helpful: 245, notHelpful: 67, reviewCount: 15 },
    ],
  },
  "zelda-echoes": {
    id: "zelda-echoes",
    name: "Zelda: Echoes of Wisdom",
    genre: "Adventure · Action RPG",
    developer: "Nintendo / Grezzo",
    releaseDate: "Sept 2024",
    platforms: ["Switch"],
    heroImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/94RTr_3GQPI",
    averageRating: 4.6,
    totalRatings: 18340,
    quickVerdict:
      "A refreshing twist on the Zelda formula. Playing as Zelda with echo abilities feels genuinely innovative, even if the difficulty is lighter than recent entries.",
    description:
      "For the first time in a mainline entry, play as Princess Zelda using the power of echoes to solve puzzles and defeat enemies. Copy objects and creatures from the environment and summon them strategically. Features a charming top-down art style reminiscent of Link's Awakening.",
    scores: { gameplay: 5, graphics: 4, story: 4, audio: 5, replayability: 4 },
    reviews: [
      { id: "r1", userName: "NintendoFan", avatar: "NF", rating: 5, text: "Finally playing as Zelda is a dream come true. The echo mechanic is brilliantly implemented.", date: "2024-10-05", helpful: 178, notHelpful: 9, reviewCount: 42 },
    ],
  },
  "silent-hill-2": {
    id: "silent-hill-2",
    name: "Silent Hill 2 Remake",
    genre: "Survival Horror",
    developer: "Bloober Team",
    releaseDate: "Oct 2024",
    platforms: ["PC", "PS5"],
    heroImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/pyj9pBFylMI",
    averageRating: 4.4,
    totalRatings: 9870,
    quickVerdict:
      "A faithful and visually stunning reimagining. Bloober Team captures the psychological dread of the original while modernizing the combat and exploration.",
    description:
      "James Sunderland's haunting journey through Silent Hill is rebuilt from the ground up in Unreal Engine 5. The fog-drenched streets and grotesque creature designs are more terrifying than ever, while the expanded combat system gives players more agency without diminishing the vulnerability that defines the experience.",
    scores: { gameplay: 4, graphics: 5, story: 5, audio: 5, replayability: 3 },
    reviews: [
      { id: "r1", userName: "HorrorLover", avatar: "HL", rating: 5, text: "This is how you do a remake. The atmosphere is incredible and they respected the source material perfectly.", date: "2024-11-01", helpful: 167, notHelpful: 11, reviewCount: 38 },
    ],
  },
  "cs2-s2": {
    id: "cs2-s2",
    name: "Counter-Strike 2: Season 2",
    genre: "FPS · Competitive",
    developer: "Valve",
    releaseDate: "March 2025",
    platforms: ["PC"],
    heroImage: "https://images.unsplash.com/photo-1552820728-8b83bb6b2b28?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/WAI6pJMIskg",
    averageRating: 4.1,
    totalRatings: 42100,
    quickVerdict:
      "Season 2 addresses many community complaints with improved smoke physics and new maps, though tick rate debates continue to divide the competitive community.",
    description:
      "Valve's latest update brings two new competitive maps, overhauled smoke physics, and the return of fan-favorite operations. The new Premier rating system provides more granular skill tracking, while community workshop improvements make modding more accessible.",
    scores: { gameplay: 4, graphics: 4, story: 2, audio: 4, replayability: 5 },
    reviews: [
      { id: "r1", userName: "CSVeteran", avatar: "CS", rating: 4, text: "Good improvements but still missing some features from CSGO. The new maps are great though.", date: "2025-04-01", helpful: 234, notHelpful: 45, reviewCount: 92 },
    ],
  },
  "civ-7": {
    id: "civ-7",
    name: "Civilization VII",
    genre: "Strategy · 4X",
    developer: "Firaxis Games",
    releaseDate: "Feb 2025",
    platforms: ["PC", "PS5", "Xbox", "Switch"],
    heroImage: "https://images.unsplash.com/photo-1606663889134-b1dedb5ed8b7?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/JRibYI0pTDc",
    averageRating: 4.5,
    totalRatings: 15200,
    quickVerdict:
      "A bold evolution of the series with the new Ages system. Moving between historical eras feels transformative, though the learning curve is steeper than ever.",
    description:
      "Build your empire across multiple ages with a revolutionary progression system that splits each playthrough into distinct historical periods. Each age transition reshapes your civilization's identity, tech tree, and available units. Features improved diplomacy, dynamic terrain, and the most detailed city-building in the series.",
    scores: { gameplay: 5, graphics: 4, story: 3, audio: 4, replayability: 5 },
    reviews: [
      { id: "r1", userName: "StrategyKing", avatar: "SK", rating: 5, text: "The Ages system is genius. Every playthrough feels completely different. Just one more turn...", date: "2025-03-01", helpful: 289, notHelpful: 15, reviewCount: 67 },
    ],
  },
  "forza-horizon-6": {
    id: "forza-horizon-6",
    name: "Forza Horizon 6",
    genre: "Racing · Open World",
    developer: "Playground Games",
    releaseDate: "Nov 2025",
    platforms: ["PC", "Xbox"],
    heroImage: "https://images.unsplash.com/photo-1511882150382-421056c89033?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/BNjMRfBNqCU",
    averageRating: 4.6,
    totalRatings: 22300,
    quickVerdict:
      "Japan delivers the most visually stunning and diverse Horizon map yet. Drifting through cherry blossoms has never felt this good.",
    description:
      "The open-world racing series heads to Japan with next-gen graphics and dynamic weather. Race through neon-lit Tokyo streets, mountain passes, and coastal highways in over 700 meticulously detailed cars. Features a new tuning system, drift challenges, and the most extensive car customization in series history.",
    scores: { gameplay: 5, graphics: 5, story: 3, audio: 5, replayability: 4 },
    reviews: [
      { id: "r1", userName: "SpeedDemon", avatar: "SD", rating: 5, text: "The Japan map is absolutely breathtaking. Mountain passes are perfect for drifting. Best Horizon yet.", date: "2025-12-01", helpful: 198, notHelpful: 8, reviewCount: 45 },
    ],
  },
  "ea-fc-26": {
    id: "ea-fc-26",
    name: "EA Sports FC 26",
    genre: "Sports · Football",
    developer: "EA Vancouver",
    releaseDate: "Sept 2025",
    platforms: ["PC", "PS5", "Xbox", "Switch"],
    heroImage: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/8eTQ5N0nwBk",
    averageRating: 3.8,
    totalRatings: 38400,
    quickVerdict:
      "Incremental improvements over FC 25. HyperMotion V makes gameplay smoother but Ultimate Team monetization remains a sore point.",
    description:
      "The world's most popular football simulation returns with HyperMotion V technology, delivering more realistic player animations and ball physics. Career mode gets major updates including player mentorship and dynamic press conferences. Ultimate Team introduces a new Moments mode.",
    scores: { gameplay: 4, graphics: 4, story: 2, audio: 3, replayability: 4 },
    reviews: [
      { id: "r1", userName: "FootballFan", avatar: "FF", rating: 3, text: "Gameplay feels smoother but it's still the same game with a fresh coat of paint. Career mode improvements are nice though.", date: "2025-10-01", helpful: 156, notHelpful: 34, reviewCount: 23 },
    ],
  },
  "monster-hunter-wilds": {
    id: "monster-hunter-wilds",
    name: "Monster Hunter Wilds",
    genre: "Action RPG · Co-op",
    developer: "Capcom",
    releaseDate: "Feb 2025",
    platforms: ["PC", "PS5", "Xbox"],
    heroImage: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1200&q=80",
    trailerUrl: "https://www.youtube.com/embed/BjHSKUaOirE",
    averageRating: 4.8,
    totalRatings: 27600,
    quickVerdict:
      "Capcom's masterpiece evolves with seamless open zones and dynamic ecosystems that make hunts feel truly alive. The best Monster Hunter experience to date.",
    description:
      "Capcom's next mainline Monster Hunter features seamless open zones and dynamic ecosystems where monsters interact naturally. New weapon stances, mount combat, and the Focus Strike system add depth to the already stellar combat. 4-player co-op remains the highlight, with cross-play across all platforms.",
    scores: { gameplay: 5, graphics: 5, story: 4, audio: 5, replayability: 5 },
    reviews: [
      { id: "r1", userName: "HunterVet", avatar: "HV", rating: 5, text: "700 hours in and I still can't put it down. The ecosystem feels alive and every hunt is different. Co-op with friends is perfection.", date: "2025-03-15", helpful: 367, notHelpful: 11, reviewCount: 54 },
      { id: "r2", userName: "NewHunter", avatar: "NH", rating: 4, text: "Amazing game but the learning curve is steep for newcomers. The tutorial could be better. Once it clicks though, it's incredible.", date: "2025-03-20", helpful: 201, notHelpful: 18, reviewCount: 8 },
    ],
  },
};

export const FEATURED_GAME = GAME_DATABASE["elden-ring-dlc"];

export const TOP_REVIEWERS = [
  { name: "LoreMaster_9000", avatar: "LM", reviews: 89, helpful: 2840 },
  { name: "SpeedRunner_X", avatar: "SR", reviews: 63, helpful: 1920 },
  { name: "DarkSoulsVet", avatar: "DS", reviews: 47, helpful: 1560 },
  { name: "PixelArtFan", avatar: "PA", reviews: 31, helpful: 980 },
  { name: "CasualGamer42", avatar: "CG", reviews: 12, helpful: 420 },
];
