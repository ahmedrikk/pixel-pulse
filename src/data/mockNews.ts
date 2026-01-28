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
}

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: "1",
    title: "GTA 6 Release Date Confirmed: Rockstar Reveals Fall 2025 Launch Window",
    summary: "Rockstar Games has officially confirmed that Grand Theft Auto VI will launch in Fall 2025, ending years of intense speculation from fans worldwide. The highly anticipated sequel marks a triumphant return to Vice City, featuring dual protagonists Lucia and Jason in what promises to be the studio's most ambitious narrative yet. Early footage showcases breathtaking next-generation graphics with unprecedented detail in character models and environmental design. The expanded open world reportedly dwarfs previous entries, offering dynamic weather systems and a living ecosystem that reacts to player choices in real-time.",
    sourceUrl: "https://ign.com",
    imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=400&fit=crop",
    category: "RPG",
    timestamp: "2024-01-15T10:30:00Z",
    source: "IGN",
    author: "Sarah Mitchell"
  },
  {
    id: "2",
    title: "PlayStation 6 Development Begins: Sony Aims for 2027 Launch",
    summary: "Sony has officially confirmed that internal development of the PlayStation 6 has commenced, with industry insiders suggesting a 2027 release window for the next-generation console. The upcoming hardware is rumored to feature revolutionary custom AMD architecture with ray-tracing capabilities that far exceed current hardware limitations. Cloud gaming integration is expected to play a central role in the new ecosystem, allowing seamless streaming of demanding titles. Early reports indicate significant improvements in SSD technology, potentially eliminating loading screens entirely and enabling instant game switching between multiple titles simultaneously.",
    sourceUrl: "https://kotaku.com",
    imageUrl: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&h=400&fit=crop",
    category: "PlayStation",
    timestamp: "2024-01-14T15:45:00Z",
    source: "Kotaku",
    author: "Jason Schreier"
  },
  {
    id: "3",
    title: "Counter-Strike 2 Major Championship Breaks Viewership Records",
    summary: "The latest Counter-Strike 2 Major Championship has shattered all previous esports viewership records, peaking at over four million concurrent viewers during the grand final match. FaZe Clan emerged victorious after a thrilling five-map series against Team Spirit, cementing their legacy as one of the greatest rosters in competitive FPS history. The event marks a transformative era for competitive first-person shooter gaming and validates Valve's decision to upgrade the classic franchise with Source 2 engine. Prize pools reached unprecedented levels, attracting top talent from around the globe.",
    sourceUrl: "https://gamespot.com",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=400&fit=crop",
    category: "FPS",
    timestamp: "2024-01-14T08:20:00Z",
    source: "GameSpot",
    author: "Michael Torres"
  },
  {
    id: "4",
    title: "Hollow Knight: Silksong Finally Gets Release Date After Years of Waiting",
    summary: "Team Cherry has officially announced that Hollow Knight: Silksong will launch on February 24, 2025, ending one of gaming's longest-running development mysteries. The long-awaited sequel stars Hornet in her own adventure through an entirely new kingdom filled with challenging bosses and intricate platforming sequences. Fans who have been following development since the 2019 announcement are celebrating across social media platforms as preorders go live on all major storefronts. The game features over 150 new enemies, completely revamped combat mechanics, and a haunting original soundtrack that promises to rival the beloved original.",
    sourceUrl: "https://polygon.com",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=400&fit=crop",
    category: "IndieGames",
    timestamp: "2024-01-13T12:00:00Z",
    source: "Polygon",
    author: "Emily Zhang"
  },
  {
    id: "5",
    title: "NVIDIA RTX 5090 Benchmarks Leak: 40% Faster Than Previous Generation",
    summary: "Leaked benchmarks for NVIDIA's upcoming RTX 5090 graphics card reveal a staggering 40 percent performance improvement over the RTX 4090, setting new standards for consumer GPU capabilities. The new flagship is expected to launch at $1,999 and will feature 24GB of next-generation GDDR7 memory with significantly improved bandwidth. Frame generation technology has been dramatically enhanced, offering near-native visual quality at substantially boosted framerates without the latency issues that plagued earlier implementations. Power efficiency improvements mean the card draws similar wattage to its predecessor despite the massive performance gains in both rasterization and ray-tracing workloads.",
    sourceUrl: "https://tomshardware.com",
    imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&h=400&fit=crop",
    category: "PCGaming",
    timestamp: "2024-01-13T09:15:00Z",
    source: "Tom's Hardware",
    author: "Dave James"
  },
  {
    id: "6",
    title: "Xbox Game Pass Adds 15 Day-One Titles in February Including Avowed",
    summary: "Microsoft has unveiled an impressive February lineup for Xbox Game Pass, headlined by Obsidian Entertainment's highly anticipated first-person RPG Avowed launching day one on the subscription service. The service continues to deliver exceptional value with major releases alongside beloved classics returning to the catalog. Phil Spencer called this their strongest month yet during a recent investor call, highlighting Microsoft's commitment to growing the subscription base through quality content. Additional titles include three indie darlings, two major third-party releases, and several beloved remasters that will appeal to both new and returning subscribers across console and PC platforms.",
    sourceUrl: "https://eurogamer.net",
    imageUrl: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800&h=400&fit=crop",
    category: "Xbox",
    timestamp: "2024-01-12T14:30:00Z",
    source: "Eurogamer",
    author: "Tom Phillips"
  }
];

export const CATEGORIES = [
  { id: "FPS", label: "#FPS", icon: "🎯" },
  { id: "RPG", label: "#RPG", icon: "⚔️" },
  { id: "IndieGames", label: "#IndieGames", icon: "🎮" },
  { id: "PlayStation", label: "#PlayStation", icon: "🎵" },
  { id: "Xbox", label: "#Xbox", icon: "❎" },
  { id: "PCGaming", label: "#PCGaming", icon: "🖥️" },
];

export const FRIENDS_ONLINE = [
  { id: "1", name: "NightBlade_99", status: "online", game: "Playing Valorant" },
  { id: "2", name: "PixelQueen", status: "online", game: "In Baldur's Gate 3" },
  { id: "3", name: "StormRider", status: "away", game: "Away" },
  { id: "4", name: "CyberNinja", status: "online", game: "Streaming Elden Ring" },
  { id: "5", name: "GhostWalker", status: "offline", game: "Last seen 2h ago" },
];

export const TRIVIA_QUESTION = {
  question: "Which game won Game of the Year at The Game Awards 2023?",
  options: [
    "Baldur's Gate 3",
    "The Legend of Zelda: TOTK",
    "Alan Wake 2",
    "Resident Evil 4"
  ],
  correctAnswer: 0
};
