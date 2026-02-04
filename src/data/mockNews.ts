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
  likes?: number;
}

export const LIVE_MATCH = {
  tournamentName: "Valorant Champions Tour",
  matchTitle: "Sentinels vs. Fnatic",
  viewers: "124,521",
  platform: "Twitch",
  streamUrl: "https://twitch.tv/valorant",
};

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
    author: "Sarah Mitchell",
    tags: ["PlayStation", "Xbox", "PCGaming", "RPG"],
    likes: 342,
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
    author: "Jason Schreier",
    tags: ["PlayStation", "PCGaming", "Indie"],
    likes: 218,
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
    author: "Michael Torres",
    tags: ["FPS", "Twitch", "xQc", "PCGaming"],
    likes: 567,
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
    author: "Emily Zhang",
    tags: ["Indie", "Nintendo", "PlayStation", "Xbox"],
    likes: 892,
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
    author: "Dave James",
    tags: ["PCGaming", "FPS", "RPG"],
    likes: 445,
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
    author: "Tom Phillips",
    tags: ["Xbox", "RPG", "Indie", "PCGaming"],
    likes: 312,
  },
  {
    id: "7",
    title: "KaiCenat Breaks Twitch Records with Marathon Gaming Stream Event",
    summary: "Popular streamer KaiCenat has shattered Twitch viewership records during his latest marathon streaming event, attracting over two million concurrent viewers at peak moments. The content creator hosted special guests including major gaming personalities and surprise celebrity appearances throughout the multi-day broadcast. Industry analysts note this achievement represents a significant shift in streaming culture, with personality-driven content now rivaling traditional esports broadcasts in viewer engagement. The event generated unprecedented chat activity and donations, cementing KaiCenat's position as one of the most influential figures in modern gaming entertainment and content creation.",
    sourceUrl: "https://dexerto.com",
    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=800&h=400&fit=crop",
    category: "Streaming",
    timestamp: "2024-01-12T11:00:00Z",
    source: "Dexerto",
    author: "Jake Lucky",
    tags: ["Twitch", "KaiCenat", "YouTube", "Kick"],
    likes: 1203,
  },
  {
    id: "8",
    title: "Nintendo Switch 2 Reveal Imminent as Leaks Flood Social Media",
    summary: "Credible leaks regarding Nintendo's next-generation console have flooded social media platforms, suggesting an official announcement may be imminent from the Japanese gaming giant. Leaked specifications indicate a significant performance upgrade, with NVIDIA's latest mobile architecture powering the hybrid device. Industry insiders claim the console will maintain backward compatibility with existing Switch titles while supporting enhanced graphics modes for newer releases. Nintendo has remained characteristically silent, but retailer listings and manufacturing reports point toward a spring announcement with a potential holiday season launch window.",
    sourceUrl: "https://nintendolife.com",
    imageUrl: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&h=400&fit=crop",
    category: "Nintendo",
    timestamp: "2024-01-11T16:45:00Z",
    source: "Nintendo Life",
    author: "Alex Olney",
    tags: ["Nintendo", "Indie", "RPG"],
    likes: 678,
  },
  {
    id: "9",
    title: "xQc Signs Exclusive Streaming Deal Worth Reported $100 Million",
    summary: "Controversial streamer and former Overwatch pro xQc has reportedly signed a groundbreaking exclusive streaming deal worth over one hundred million dollars, according to industry sources. The multi-year agreement represents one of the largest individual creator contracts in streaming history, reflecting the immense value platforms place on top-tier content creators. The deal includes guaranteed minimum payouts regardless of viewership metrics, along with substantial creative freedom provisions. Gaming industry analysts suggest this contract could trigger a new wave of platform competition for established streamers as companies seek to secure exclusive content arrangements.",
    sourceUrl: "https://esportsheadlines.com",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=400&fit=crop",
    category: "Streaming",
    timestamp: "2024-01-11T09:30:00Z",
    source: "Esports Headlines",
    author: "Richard Lewis",
    tags: ["xQc", "Twitch", "Kick", "YouTube"],
    likes: 534,
  },
  {
    id: "10",
    title: "Ninja Returns to Streaming After Health Scare with Emotional Broadcast",
    summary: "Legendary Fortnite streamer Ninja has made an emotional return to streaming following his recent health scare that required medical attention and time away from content creation. The broadcast attracted hundreds of thousands of viewers eager to welcome back one of gaming's most recognizable personalities. During the stream, Ninja expressed gratitude for the overwhelming support from fans and fellow creators during his recovery period. The veteran content creator announced plans for a more balanced streaming schedule moving forward, prioritizing personal wellness while maintaining connection with his dedicated community.",
    sourceUrl: "https://kotaku.com",
    imageUrl: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&h=400&fit=crop",
    category: "Streaming",
    timestamp: "2024-01-10T14:00:00Z",
    source: "Kotaku",
    author: "Patricia Hernandez",
    tags: ["Ninja", "Twitch", "YouTube", "FPS"],
    likes: 2341,
  },
];

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
  { id: "Kick", label: "#Kick", icon: "🟢" },
];

export const STREAMER_TAGS = [
  { id: "KaiCenat", label: "#KaiCenat" },
  { id: "xQc", label: "#xQc" },
  { id: "Ninja", label: "#Ninja" },
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
