import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock3, ExternalLink, Gift, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { useFreeGames, type FreeGameOffer } from "@/hooks/useFreeGames";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Epic Games", "Steam", "GOG", "itch.io", "Mobile", "Other"];

const kindLabel = {
  keep: "Free to keep",
  timed: "Free weekend",
  other: "Free extra",
};

function endingLabel(endsAt: string | null) {
  if (!endsAt) return "No end date listed";
  const end = new Date(endsAt);
  if (end.getTime() <= Date.now()) return "Ending now";
  return `Ends in ${formatDistanceToNowStrict(end)}`;
}

function timingLabel(offer: FreeGameOffer) {
  if (offer.status === "upcoming" && offer.startsAt) {
    return `Starts in ${formatDistanceToNowStrict(new Date(offer.startsAt))}`;
  }
  return endingLabel(offer.endsAt);
}

function OfferCard({ offer, index }: { offer: FreeGameOffer; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.25 }}
      className="group overflow-hidden rounded-2xl border bg-card card-shadow transition-all hover:-translate-y-1 hover:card-shadow-hover"
    >
      <Link to={`/reviews/${offer.gameId}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
          {offer.imageUrl ? (
            <img
              src={offer.imageUrl}
              alt={`${offer.title} giveaway`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Gift className="h-12 w-12 text-primary/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-bold text-foreground backdrop-blur-sm">
            {offer.storeName}
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            {offer.status === "upcoming" ? "Coming soon" : kindLabel[offer.offerKind]}
          </span>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-1 text-base font-bold text-foreground">
            <Link to={`/reviews/${offer.gameId}`} className="transition-colors hover:text-primary">{offer.title}</Link>
          </h2>
          <p className="mt-1.5 line-clamp-3 min-h-[60px] text-sm leading-5 text-muted-foreground">
            {offer.description || "Talus is preparing this game's full editorial overview."}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {offer.platforms.slice(0, 3).map((platform) => (
            <span key={platform} className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              {platform}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <div>
            <div className="flex items-baseline gap-2">
              {offer.worthText && <span className="text-xs text-muted-foreground line-through">{offer.worthText}</span>}
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">FREE</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {timingLabel(offer)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={`/reviews/${offer.gameId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-foreground transition-colors hover:text-primary"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Read more
            </Link>
            <a
              href={offer.offerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {offer.status === "upcoming" ? "View offer" : "Claim"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function FreeGames() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { data: offers = [], isLoading, error } = useFreeGames();

  const filteredOffers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter((offer) => {
      const storeMatch = filter === "All" || (filter === "Other"
        ? !FILTERS.slice(1, -1).includes(offer.storeName)
        : offer.storeName === filter);
      const searchMatch = !query || `${offer.title} ${offer.description} ${offer.platforms.join(" ")}`.toLowerCase().includes(query);
      return storeMatch && searchMatch;
    });
  }, [filter, offers, search]);

  const activeOffers = filteredOffers.filter((offer) => offer.status === "active");
  const upcomingOffers = filteredOffers.filter((offer) => offer.status === "upcoming");
  const liveOfferCount = offers.filter((offer) => offer.status === "active").length;
  const upcomingOfferCount = offers.filter((offer) => offer.status === "upcoming").length;
  const totalClaims = offers.reduce((sum, offer) => sum + offer.usersCount, 0);

  return (
    <>
      <SiteLayout>
        <div className="space-y-7 pb-16 md:pb-0">
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7"
          >
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-24 left-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Gift className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-black text-foreground md:text-4xl">
                <span className="text-gradient">Free Games</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Never miss a game that suddenly drops to free. Talus watches trusted storefronts, surfaces live and upcoming offers before the clock runs out, and connects every deal to full game details and community reviews.
              </p>
              {!isLoading && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">
                    {liveOfferCount} live {liveOfferCount === 1 ? "offer" : "offers"}
                  </span>
                  {upcomingOfferCount > 0 && (
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">
                      {upcomingOfferCount} upcoming
                    </span>
                  )}
                  {totalClaims > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {totalClaims.toLocaleString()} community claims
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.header>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Sparkles, title: "One feed, many stores", text: "Epic, Steam, GOG, itch.io, and other trusted sources—organized in one place." },
              { icon: ShieldCheck, title: "Beat the expiry clock", text: "Live and upcoming offers are checked every 30 minutes, with the deadline shown up front." },
              { icon: ExternalLink, title: "Claim it, then explore", text: "Go straight to the claim destination or open the full game page for details and reviews." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border bg-card p-4">
                <item.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-2 text-sm font-bold text-foreground">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </section>

          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search free games…"
                className="border-0 bg-secondary pl-10 focus-visible:ring-primary"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 mobile-cat-scroll">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === item ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {upcomingOffers.length > 0 && !isLoading && !error && (
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground">Coming next</h2>
                <p className="mt-1 text-sm text-muted-foreground">Upcoming giveaways already announced by a storefront.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {upcomingOffers.map((offer, index) => <OfferCard key={offer.id} offer={offer} index={index} />)}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Available now</h2>
                <p className="mt-1 text-sm text-muted-foreground">Claim through the storefront before the timer ends.</p>
              </div>
              {!isLoading && <span className="shrink-0 text-sm text-muted-foreground">{activeOffers.length} shown</span>}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-2xl bg-secondary" />)}
              </div>
            ) : error ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <p className="font-semibold text-foreground">Free-game offers are temporarily unavailable.</p>
                <p className="mt-1 text-sm text-muted-foreground">Please try again shortly.</p>
              </div>
            ) : activeOffers.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activeOffers.map((offer, index) => <OfferCard key={offer.id} offer={offer} index={index} />)}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-10 text-center">
                <Gift className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 font-semibold text-foreground">No matching giveaway right now</p>
                <p className="mt-1 text-sm text-muted-foreground">Try another store or check back after the next refresh.</p>
              </div>
            )}
          </section>

          <p className="text-center text-[11px] text-muted-foreground">
            Giveaway data from the{" "}
            <a href="https://store.epicgames.com/en-US/free-games" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              Epic Games Store
            </a>{" "}
            and{" "}
            <a href="https://www.gamerpower.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              GamerPower
            </a>. Discovery experience inspired by{" "}
            <a href="https://freestuffbot.xyz/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              FreeStuff
            </a>. Talus does not sell or fulfill these offers. Availability can vary by region.
          </p>
        </div>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
