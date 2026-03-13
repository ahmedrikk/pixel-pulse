/**
 * Smart Tag Generator
 * Extracts relevant gaming hashtags from article content using pattern matching
 * Used as fallback when AI processing is unavailable
 */

// Known game titles for pattern matching
const KNOWN_GAMES = [
  // Major AAA titles
  "GTA 6", "GTA6", "Grand Theft Auto 6", "Grand Theft Auto VI",
  "Elden Ring", "EldenRing",
  "Baldur's Gate 3", "Baldurs Gate 3", "BG3",
  "Counter-Strike 2", "CS2", "CS:GO",
  "Valorant",
  "Call of Duty", "COD", "Modern Warfare", "Black Ops",
  "Fortnite",
  "Minecraft",
  "League of Legends", "LoL",
  "Dota 2",
  "Overwatch", "Overwatch 2", "OW2",
  "Apex Legends",
  "PUBG",
  "Rocket League",
  "Rainbow Six Siege", "R6",
  "Destiny 2",
  "World of Warcraft", "WoW",
  "Final Fantasy", "FF14", "FF16",
  "The Legend of Zelda", "Zelda", "TOTK", "Tears of the Kingdom",
  "Mario", "Super Mario",
  "Pokemon",
  "Halo",
  "Gears of War",
  "Forza",
  "Gran Turismo",
  "Spider-Man", "Spiderman",
  "God of War", "Kratos",
  "The Last of Us",
  "Uncharted",
  "Horizon", "Horizon Zero Dawn", "Horizon Forbidden West",
  "Ghost of Tsushima",
  "Death Stranding",
  "Cyberpunk 2077",
  "The Witcher",
  "Skyrim", "Elder Scrolls",
  "Fallout",
  "Starfield",
  "Hollow Knight", "Silksong",
  "Celeste",
  "Hades",
  "Stardew Valley",
  "Terraria",
  "Among Us",
  "Fall Guys",
  "Roblox",
  "Genshin Impact",
  "Honkai Star Rail",
  "Astro Bot",
  "Avowed",
  "Ninja Gaiden",
  "Monster Hunter",
  "Resident Evil",
  "Silent Hill",
  "Dead Space",
  "Alan Wake",
  "Control",
  "Remnant",
  "Lies of P",
  "Palworld",
  "Helldivers", "Helldivers 2",
  "Baldur",
  "Diablo",
  "Path of Exile",
  "Lost Ark",
  "New World",
  "ARK",
  "Rust",
  "DayZ",
  "Escape from Tarkov",
  "Squad",
  "Hell Let Loose",
  "War Thunder",
  "Warframe",
  "Destiny",
  "The Finals",
  "XDefiant",
  "Suicide Squad",
  "Gotham Knights",
  "Arkham",
  "Batman",
  "Injustice",
  "Mortal Kombat", "MK1",
  "Street Fighter", "SF6",
  "Tekken",
  "Guilty Gear",
  "King of Fighters",
  "Soulcalibur",
  "Dead or Alive",
  "Super Smash Bros", "Smash Bros",
  "Kirby",
  "Metroid",
  "Donkey Kong",
  "Splatoon",
  "Animal Crossing",
  "Fire Emblem",
  "Xenoblade",
  "Persona",
  "Shin Megami Tensei",
  "Dragon Quest",
  "Monster Hunter",
  "Phoenix Wright",
  "Professor Layton",
  "Rhythm Heaven",
  "WarioWare",
  "Pikmin",
  "ARMS",
  "Ring Fit",
  "Nintendo Labo",
  "Game Builder Garage",
  "Nintendo Switch Sports",
  "Mario Kart",
  "Mario Party",
  "Super Mario Odyssey",
  "Super Mario Bros",
  "Mario RPG",
  "Luigi",
  "Princess Peach",
  "Bowser",
  "Yoshi",
  "Wario",
  "Waluigi",
  "Toad",
  "Rosalina",
  "Daisy",
  "Pauline",
  "Cappy",
  "Captain Toad",
];

// Platform keywords
const PLATFORMS = [
  { keywords: ["PS5", "PlayStation 5", "PlayStation5"], tag: "PS5" },
  { keywords: ["PS4", "PlayStation 4", "PlayStation4"], tag: "PS4" },
  { keywords: ["Xbox Series X", "Xbox Series S", "XboxSeriesX"], tag: "XboxSeriesX" },
  { keywords: ["Xbox One"], tag: "XboxOne" },
  { keywords: ["Xbox"], tag: "Xbox" },
  { keywords: ["Nintendo Switch", "Switch 2", "Switch2"], tag: "NintendoSwitch" },
  { keywords: ["Switch"], tag: "Switch" },
  { keywords: ["PC Gaming", "PCGaming", "Steam"], tag: "PCGaming" },
  { keywords: ["Steam Deck", "SteamDeck"], tag: "SteamDeck" },
  { keywords: ["Mobile", "iOS", "Android"], tag: "MobileGaming" },
  { keywords: ["VR", "Quest", "PSVR", "Vision Pro"], tag: "VR" },
];

// Genre keywords
const GENRES = [
  { keywords: ["RPG", "role-playing", "role playing"], tag: "RPG" },
  { keywords: ["FPS", "first-person shooter", "first person shooter"], tag: "FPS" },
  { keywords: ["battle royale", "battle-royale"], tag: "BattleRoyale" },
  { keywords: ["MOBA"], tag: "MOBA" },
  { keywords: ["indie", "indie game"], tag: "IndieGame" },
  { keywords: ["roguelike", "rogue-like"], tag: "Roguelike" },
  { keywords: ["roguelite", "rogue-lite"], tag: "Roguelite" },
  { keywords: ["metroidvania"], tag: "Metroidvania" },
  { keywords: ["soulslike", "souls-like"], tag: "Soulslike" },
  { keywords: ["open world", "open-world"], tag: "OpenWorld" },
  { keywords: ["sandbox"], tag: "Sandbox" },
  { keywords: ["strategy"], tag: "Strategy" },
  { keywords: ["simulation", "sim"], tag: "Simulation" },
  { keywords: ["sports", "football", "basketball", "soccer", "FIFA", "Madden", "NBA 2K"], tag: "Sports" },
  { keywords: ["racing"], tag: "Racing" },
  { keywords: ["fighting", "fighter"], tag: "Fighting" },
  { keywords: ["platformer"], tag: "Platformer" },
  { keywords: ["puzzle"], tag: "Puzzle" },
  { keywords: ["horror", "survival horror"], tag: "Horror" },
  { keywords: ["survival"], tag: "Survival" },
  { keywords: ["adventure"], tag: "Adventure" },
  { keywords: ["action"], tag: "Action" },
  { keywords: ["co-op", "coop", "cooperative"], tag: "CoOp" },
  { keywords: ["multiplayer"], tag: "Multiplayer" },
  { keywords: ["single-player", "singleplayer"], tag: "SinglePlayer" },
];

// Content type keywords
const CONTENT_TYPES = [
  { keywords: ["release date", "launch date", "coming soon", "announced"], tag: "NewRelease" },
  { keywords: ["update", "patch", "hotfix"], tag: "Update" },
  { keywords: ["DLC", "expansion", "season pass"], tag: "DLC" },
  { keywords: ["remake"], tag: "Remake" },
  { keywords: ["remaster"], tag: "Remaster" },
  { keywords: ["port"], tag: "Port" },
  { keywords: ["sequel"], tag: "Sequel" },
  { keywords: ["reboot"], tag: "Reboot" },
  { keywords: ["trailer", "gameplay trailer"], tag: "Trailer" },
  { keywords: ["gameplay"], tag: "Gameplay" },
  { keywords: ["review"], tag: "Review" },
  { keywords: ["preview", "hands-on", "hands on"], tag: "Preview" },
  { keywords: ["interview"], tag: "Interview" },
  { keywords: ["rumor", "rumour", "speculation"], tag: "Rumor" },
  { keywords: ["leak", "leaked"], tag: "Leak" },
  { keywords: ["delay", "delayed", "postponed"], tag: "Delay" },
  { keywords: ["cancelled", "canceled"], tag: "Cancelled" },
  { keywords: ["benchmark", "performance test"], tag: "Benchmark" },
];

// Studio/Publisher keywords
const STUDIOS = [
  { keywords: ["Nintendo"], tag: "Nintendo" },
  { keywords: ["Rockstar"], tag: "RockstarGames" },
  { keywords: ["FromSoftware", "From Software"], tag: "FromSoftware" },
  { keywords: ["CD Projekt", "CDProjekt"], tag: "CDProjektRed" },
  { keywords: ["Naughty Dog"], tag: "NaughtyDog" },
  { keywords: ["Santa Monica Studio"], tag: "SantaMonicaStudio" },
  { keywords: ["Insomniac"], tag: "InsomniacGames" },
  { keywords: ["Guerrilla"], tag: "GuerrillaGames" },
  { keywords: ["Sucker Punch"], tag: "SuckerPunch" },
  { keywords: ["Bungie"], tag: "Bungie" },
  { keywords: ["343 Industries", "343i"], tag: "343Industries" },
  { keywords: ["Obsidian"], tag: "Obsidian" },
  { keywords: ["InXile"], tag: "InXile" },
  { keywords: ["Playground Games"], tag: "PlaygroundGames" },
  { keywords: ["Turn 10"], tag: "Turn10" },
  { keywords: ["The Coalition"], tag: "TheCoalition" },
  { keywords: ["Rare"], tag: "Rare" },
  { keywords: ["Double Fine"], tag: "DoubleFine" },
  { keywords: ["Bethesda"], tag: "Bethesda" },
  { keywords: ["id Software"], tag: "idSoftware" },
  { keywords: ["Arkane"], tag: "Arkane" },
  { keywords: ["MachineGames"], tag: "MachineGames" },
  { keywords: ["Tango Gameworks"], tag: "TangoGameworks" },
  { keywords: ["Valve"], tag: "Valve" },
  { keywords: ["Blizzard"], tag: "Blizzard" },
  { keywords: ["Epic Games"], tag: "EpicGames" },
  { keywords: ["EA", "Electronic Arts"], tag: "EA" },
  { keywords: ["Ubisoft"], tag: "Ubisoft" },
  { keywords: ["Activision"], tag: "Activision" },
  { keywords: ["Square Enix"], tag: "SquareEnix" },
  { keywords: ["Capcom"], tag: "Capcom" },
  { keywords: ["Sega"], tag: "Sega" },
  { keywords: ["Atlus"], tag: "Atlus" },
  { keywords: ["Bandai Namco"], tag: "BandaiNamco" },
  { keywords: ["Konami"], tag: "Konami" },
  { keywords: ["Kojima Productions"], tag: "KojimaProductions" },
  { keywords: ["PlatinumGames"], tag: "PlatinumGames" },
  { keywords: ["Team Cherry"], tag: "TeamCherry" },
  { keywords: ["Supergiant"], tag: "SupergiantGames" },
  { keywords: ["ConcernedApe"], tag: "ConcernedApe" },
  { keywords: ["Mojang"], tag: "Mojang" },
  { keywords: ["Riot Games"], tag: "RiotGames" },
  { keywords: ["Respawn"], tag: "Respawn" },
  { keywords: ["BioWare"], tag: "BioWare" },
  { keywords: ["DICE"], tag: "DICE" },
  { keywords: ["Criterion"], tag: "Criterion" },
  { keywords: ["Crytek"], tag: "Crytek" },
  { keywords: ["4A Games"], tag: "4AGames" },
  { keywords: ["Techland"], tag: "Techland" },
  { keywords: ["Larian"], tag: "LarianStudios" },
  { keywords: ["Fatshark"], tag: "Fatshark" },
  { keywords: ["Arrowhead"], tag: "Arrowhead" },
  { keywords: ["Housemarque"], tag: "Housemarque" },
  { keywords: ["Remedy"], tag: "Remedy" },
  { keywords: ["Hello Games"], tag: "HelloGames" },
  { keywords: ["Cloud Imperium"], tag: "CloudImperium" },
  { keywords: ["Frontier"], tag: "FrontierDevelopments" },
  { keywords: ["Re-Logic"], tag: "ReLogic" },
  { keywords: ["Chucklefish"], tag: "Chucklefish" },
  { keywords: ["Innersloth"], tag: "Innersloth" },
  { keywords: ["Mediatonic"], tag: "Mediatonic" },
  { keywords: ["miHoYo", "HoYoverse"], tag: "HoYoverse" },
  { keywords: ["Pearl Abyss"], tag: "PearlAbyss" },
  { keywords: ["Smilegate"], tag: "Smilegate" },
  { keywords: ["Amazon Games"], tag: "AmazonGames" },
  { keywords: [" grinding gear"], tag: "GrindingGearGames" },
];

// Streamer/Content Creator keywords
const STREAMERS = [
  { keywords: ["Kai Cenat", "KaiCenat"], tag: "KaiCenat" },
  { keywords: ["xQc"], tag: "xQc" },
  { keywords: ["Ninja"], tag: "Ninja" },
  { keywords: ["Pokimane"], tag: "Pokimane" },
  { keywords: ["Shroud"], tag: "Shroud" },
  { keywords: ["Dr Disrespect"], tag: "DrDisrespect" },
  { keywords: ["TimTheTatman"], tag: "TimTheTatman" },
  { keywords: ["DrLupo"], tag: "DrLupo" },
  { keywords: ["Summit1g"], tag: "Summit1g" },
  { keywords: ["sodapoppin"], tag: "Sodapoppin" },
  { keywords: ["LIRIK"], tag: "LIRIK" },
  { keywords: ["Sykkuno"], tag: "Sykkuno" },
  { keywords: ["Corpse Husband"], tag: "CorpseHusband" },
  { keywords: ["Valkyrae"], tag: "Valkyrae" },
  { keywords: ["Fuslie"], tag: "Fuslie" },
  { keywords: ["HasanAbi"], tag: "HasanAbi" },
  { keywords: ["Mizkif"], tag: "Mizkif" },
  { keywords: ["Emiru"], tag: "Emiru" },
  { keywords: ["Esfand"], tag: "Esfand" },
  { keywords: ["Asmongold"], tag: "Asmongold" },
  { keywords: ["Disguised Toast"], tag: "DisguisedToast" },
  { keywords: ["Ironmouse"], tag: "Ironmouse" },
  { keywords: ["CDawgVA"], tag: "CDawgVA" },
  { keywords: ["Jerma"], tag: "Jerma" },
  { keywords: ["RTGame"], tag: "RTGame" },
  { keywords: ["CallMeKevin"], tag: "CallMeKevin" },
  { keywords: ["Jacksepticeye"], tag: "Jacksepticeye" },
  { keywords: ["Markiplier"], tag: "Markiplier" },
  { keywords: ["PewDiePie"], tag: "PewDiePie" },
  { keywords: ["MrBeast"], tag: "MrBeast" },
  { keywords: ["Dream"], tag: "Dream" },
  { keywords: ["TommyInnit"], tag: "TommyInnit" },
  { keywords: ["Wilbur Soot"], tag: "WilburSoot" },
  { keywords: ["Technoblade"], tag: "Technoblade" },
  { keywords: ["Philza"], tag: "Philza" },
  { keywords: ["Tubbo"], tag: "Tubbo" },
  { keywords: ["Ranboo"], tag: "Ranboo" },
  { keywords: ["Quackity"], tag: "Quackity" },
  { keywords: ["Karl Jacobs"], tag: "KarlJacobs" },
  { keywords: ["Corpse"], tag: "CorpseHusband" },
  { keywords: ["Punz"], tag: "Punz" },
  { keywords: ["Sapnap"], tag: "Sapnap" },
  { keywords: ["GeorgeNotFound"], tag: "GeorgeNotFound" },
  { keywords: ["BadBoyHalo"], tag: "BadBoyHalo" },
  { keywords: ["Skeppy"], tag: "Skeppy" },
  { keywords: ["a6d"], tag: "A6D" },
  { keywords: ["Foolish"], tag: "FoolishGamers" },
  { keywords: ["TinaKitten"], tag: "TinaKitten" },
  { keywords: ["Brett Cooper"], tag: "BrettCooper" },
  { keywords: ["CaseOh"], tag: "CaseOh" },
];

// Hardware/tech keywords
const HARDWARE = [
  { keywords: ["RTX 5090", "RTX5090"], tag: "RTX5090" },
  { keywords: ["RTX 5080", "RTX5080"], tag: "RTX5080" },
  { keywords: ["RTX 5070", "RTX5070"], tag: "RTX5070" },
  { keywords: ["RTX 4090", "RTX4090"], tag: "RTX4090" },
  { keywords: ["RTX 4080", "RTX4080"], tag: "RTX4080" },
  { keywords: ["RTX 4070", "RTX4070"], tag: "RTX4070" },
  { keywords: ["RTX 3090", "RTX3090"], tag: "RTX3090" },
  { keywords: ["NVIDIA"], tag: "NVIDIA" },
  { keywords: ["AMD"], tag: "AMD" },
  { keywords: ["Ryzen"], tag: "Ryzen" },
  { keywords: ["Intel"], tag: "Intel" },
  { keywords: ["Core i9", "Core i7", "Core i5"], tag: "IntelCore" },
  { keywords: ["Radeon"], tag: "Radeon" },
  { keywords: ["DLSS"], tag: "DLSS" },
  { keywords: ["FSR"], tag: "FSR" },
  { keywords: ["Ray Tracing", "ray-tracing", "raytracing"], tag: "RayTracing" },
  { keywords: ["4K"], tag: "4KGaming" },
  { keywords: ["8K"], tag: "8KGaming" },
  { keywords: ["144Hz", "240Hz", "360Hz"], tag: "HighRefreshRate" },
  { keywords: ["OLED"], tag: "OLED" },
  { keywords: ["HDR"], tag: "HDR" },
];

interface TagMatch {
  tag: string;
  priority: number;
}

/**
 * Extracts tags from article content using pattern matching
 * @param title - Article title
 * @param content - Article content/summary
 * @returns Array of relevant tags
 */
export function generateSmartTags(title: string, content: string): string[] {
  const text = `${title} ${content}`;
  const textLower = text.toLowerCase();
  const tags: TagMatch[] = [];

  // Helper to check for matches
  const findMatches = (
    patterns: { keywords: string[]; tag: string }[],
    priority: number
  ) => {
    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        // Case-insensitive match for multi-word keywords
        const keywordLower = keyword.toLowerCase();
        if (textLower.includes(keywordLower)) {
          // Check for word boundaries for short keywords
          if (keyword.length < 4) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (!regex.test(text)) continue;
          }
          
          // Avoid duplicates
          if (!tags.some(t => t.tag === pattern.tag)) {
            tags.push({ tag: pattern.tag, priority });
          }
          break; // Found match for this pattern, move to next
        }
      }
    }
  };

  // Priority 1: Game titles (highest priority)
  for (const game of KNOWN_GAMES) {
    const gameLower = game.toLowerCase();
    if (textLower.includes(gameLower)) {
      // Convert to PascalCase tag
      const tagName = game
        .replace(/[:'-]/g, '')
        .replace(/\s+/g, '')
        .replace(/\d+/g, (match) => match); // Keep numbers
      
      if (!tags.some(t => t.tag === tagName)) {
        tags.push({ tag: tagName, priority: 1 });
      }
    }
  }

  // Priority 2: Platforms
  findMatches(PLATFORMS, 2);

  // Priority 3: Content types
  findMatches(CONTENT_TYPES, 3);

  // Priority 4: Studios
  findMatches(STUDIOS, 4);

  // Priority 5: Streamers
  findMatches(STREAMERS, 5);

  // Priority 6: Hardware
  findMatches(HARDWARE, 6);

  // Priority 7: Genres
  findMatches(GENRES, 7);

  // Sort by priority and get unique tags
  const sortedTags = tags
    .sort((a, b) => a.priority - b.priority)
    .map(t => t.tag)
    .slice(0, 8);

  return sortedTags;
}

/**
 * Returns AI tags when available; falls back to smart pattern-matched tags only when AI has none.
 * Never mixes AI + keyword tags — AI output is trusted as-is.
 */
export function mergeTags(aiTags: string[], originalTags: string[], title: string, content: string): string[] {
  // Clean AI tags (strip any accidental # prefix)
  const cleanAiTags = aiTags
    .map(t => t.trim().replace(/^#/, ""))
    .filter(t => t.length > 0);

  // If AI returned tags, trust them exclusively
  if (cleanAiTags.length > 0) {
    return cleanAiTags.slice(0, 8);
  }

  // Fallback: use pattern-matched smart tags
  return generateSmartTags(title, content).slice(0, 8);
}
