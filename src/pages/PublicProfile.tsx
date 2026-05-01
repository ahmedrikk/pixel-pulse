import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Gamepad2,
    Trophy,
    Clock,
    Zap,
    MessageCircle,
    Monitor,
    Link as LinkIcon,
    Loader2,
    CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { Avatar } from "@/components/Avatar";
import {
    getProfileByUsername,
    getSocialAccounts,
    getUserGames,
    type Profile as ProfileType,
    type SocialAccount,
    type UserGame,
    type UserNewsPreference,
    getNewsPreferences
} from "@/lib/profile";
import { Hash } from "lucide-react";

// Steam Icon Component
const SteamIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.979 0C5.366 0 0 5.367 0 11.979c0 2.78.94 5.34 2.533 7.364l.834-1.308c-1.324-1.726-2.108-3.88-2.108-6.225 0-5.55 4.534-10.053 10.117-10.053 5.583 0 10.117 4.503 10.117 10.053 0 5.55-4.534 10.053-10.117 10.053-1.273 0-2.495-.242-3.62-.676l-1.388.973C8.762 23.696 10.316 24 11.98 24 18.592 24 24 18.632 24 12.02 24 5.408 18.592 0 11.98 0zm5.368 5.288a3.445 3.445 0 0 0-3.428 3.467 3.445 3.445 0 0 0 3.428 3.467 3.445 3.445 0 0 0 3.428-3.467 3.445 3.445 0 0 0-3.428-3.467zm0 1.403a2.064 2.064 0 0 1 2.025 2.064 2.064 2.064 0 0 1-2.025 2.064 2.064 2.064 0 0 1-2.025-2.064 2.064 2.064 0 0 1 2.025-2.064zM7.143 12.56l-3.96 5.65a7.63 7.63 0 0 0 2.644 1.982l4.358-4.443a3.48 3.48 0 0 1-.334-1.488c0-.81.28-1.556.747-2.147l-.465-1.51-2.99 1.957z" />
    </svg>
);

export default function PublicProfile() {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
    // We only care about showcased games for the public profile
    const [featuredGames, setFeaturedGames] = useState<UserGame[]>([]);
    const [interests, setInterests] = useState<UserNewsPreference[]>([]);

    useEffect(() => {
        if (username) {
            loadPublicProfile(username);
        } else {
            setError("No username provided");
            setLoading(false);
        }
    }, [username]);

    async function loadPublicProfile(uname: string) {
        setLoading(true);
        setError(null);
        try {
            const profileData = await getProfileByUsername(uname);
            if (!profileData) {
                setError("User not found");
                return;
            }

            setProfile(profileData);

            const [socialData, gamesData, preferencesData] = await Promise.all([
                getSocialAccounts(profileData.id),
                getUserGames(profileData.id),
                getNewsPreferences(profileData.id)
            ]);

            setSocialAccounts(socialData);
            setInterests(preferencesData);

            // Filter ONLY featured/showcased games
            setFeaturedGames(gamesData.filter(g => g.is_favorite));

        } catch (err) {
            console.error(err);
            setError("Failed to load profile");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold mb-4">404</h1>
                <p className="text-xl text-muted-foreground mb-8">{error || "Profile not found"}</p>
                <Button onClick={() => navigate('/')}>Return Home</Button>
            </div>
        );
    }

    const steamAccount = socialAccounts.find(s => s.provider === 'steam');
    const discordAccount = socialAccounts.find(s => s.provider === 'discord');
    const epicAccount = socialAccounts.find(s => s.provider === 'epic');
    const totalPlaytime = featuredGames.reduce((sum, g) => sum + (g.playtime_hours || 0), 0);

    return (
        <div className="min-h-screen bg-background">
            {/* ======================================== */}
            {/* HERO BANNER                              */}
            {/* ======================================== */}
            <div className="relative overflow-hidden group/banner">
                {/* Background Image or Gradient */}
                {profile?.banner_url ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${profile.banner_url})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 dark:from-primary/20 dark:via-accent/10 dark:to-transparent" />
                )}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.15),_transparent_60%)] pointer-events-none" />
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

                <div className="relative container max-w-5xl mx-auto px-4 pt-24 pb-8 z-10">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-8">

                        {/* Avatar & Nameplate Container */}
                        <div className="relative flex justify-center items-center h-40 w-40 shrink-0 mt-4 md:mt-0">
                            <Avatar src={profile.avatar_url} fallback={profile.username} frameUrl={profile.nameplate_url ?? undefined} size="lg" />
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                {profile.display_name}
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                @{profile.username}
                            </p>
                            <p className="text-sm text-foreground/70 mt-3 max-w-lg leading-relaxed">
                                {profile.about_me || "This user is mysterious and hasn't written a bio yet."}
                            </p>

                            <div className="flex items-center justify-center md:justify-start gap-4 mt-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />
                                    Joined {new Date(profile.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======================================== */}
            {/* MAIN CONTENT                             */}
            {/* ======================================== */}
            <div className="container max-w-5xl mx-auto px-4 pb-16 space-y-8 relative z-10">

                {/* ---- STATS ROW ---- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Trophy className="h-5 w-5 text-yellow-500" />}
                        label="Level"
                        value={String(profile.level || 1)}
                        sub={`${(profile.xp || 0) % 100} / 100 XP`}
                        highlight={true}
                    />
                    <StatCard
                        icon={<Zap className="h-5 w-5 text-orange-500" />}
                        label="Best Streak"
                        value={String(profile.daily_streak || 0)}
                        sub="days"
                    />
                    <StatCard
                        icon={<Gamepad2 className="h-5 w-5 text-primary" />}
                        label="Showcased Games"
                        value={String(featuredGames.length)}
                        sub="hand-picked favorites"
                    />
                    <StatCard
                        icon={<Clock className="h-5 w-5 text-accent" />}
                        label="Playtime"
                        value={totalPlaytime.toLocaleString()}
                        sub="hrs across showcase"
                    />
                </div>

                {/* ---- SHOWCASED GAMES ---- */}
                <Section title={`${profile.display_name}'s Highlight Reel`} icon={<Trophy className="h-5 w-5 text-yellow-500" />}>
                    {featuredGames.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-lg border border-border/50">
                            <Gamepad2 className="h-16 w-16 mx-auto mb-4 opacity-15" />
                            <p className="text-lg font-medium">Nothing to see here</p>
                            <p className="text-sm">This user hasn't showcased any games yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {featuredGames.map(game => (
                                <div key={game.id} className="relative group overflow-hidden rounded-xl border border-border/50 bg-card text-center hover:border-primary/50 hover:shadow-lg transition-all h-[240px] flex flex-col justify-end">
                                    {game.image_url ? (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center opacity-50 group-hover:opacity-75 transition-opacity duration-300"
                                            style={{ backgroundImage: `url(${game.image_url})` }}
                                        />
                                    ) : (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-transparent" />
                                    )}

                                    <div className="relative z-10 flex flex-col h-full bg-gradient-to-t from-background via-background/80 to-transparent p-6 pb-4">
                                        {!game.image_url && <Gamepad2 className="h-12 w-12 mx-auto mb-4 text-primary/40 group-hover:text-primary transition-colors duration-300" />}

                                        <div className="mt-auto">
                                            <p className="font-bold text-lg truncate drop-shadow-md" title={game.game_name}>{game.game_name}</p>
                                            {game.platform && (
                                                <span className="inline-block mt-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-secondary/80 text-secondary-foreground rounded-full backdrop-blur-sm">
                                                    {game.platform}
                                                </span>
                                            )}
                                            {game.playtime_hours ? (
                                                <p className="text-xs text-foreground mt-3 font-semibold drop-shadow-md">
                                                    {game.playtime_hours.toLocaleString()} hrs played
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* ---- CONNECTED ACCOUNTS ---- */}
                {socialAccounts.length > 0 && (
                    <Section title="Connected Accounts" icon={<LinkIcon className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {steamAccount && (
                                <AccountCard
                                    icon={<SteamIcon className="h-6 w-6 text-white" />}
                                    name="Steam"
                                    bgColor="bg-[#1b2838]"
                                    username={steamAccount.username}
                                    profileUrl={steamAccount.profile_url}
                                />
                            )}
                            {discordAccount && (
                                <AccountCard
                                    icon={<MessageCircle className="h-6 w-6 text-white" />}
                                    name="Discord"
                                    bgColor="bg-[#5865F2]"
                                    username={discordAccount.username}
                                    profileUrl={discordAccount.profile_url}
                                />
                            )}
                            {epicAccount && (
                                <AccountCard
                                    icon={<Monitor className="h-6 w-6 text-black dark:text-white" />}
                                    name="Epic Games"
                                    bgColor="bg-white dark:bg-zinc-800 border"
                                    username={epicAccount.username}
                                    profileUrl={epicAccount.profile_url}
                                />
                            )}
                        </div>
                    </Section>
                )}

                {/* ---- INTERESTS ---- */}
                {interests.length > 0 && (
                    <Section title="Interests" icon={<Hash className="h-5 w-5 text-muted-foreground" />}>
                        <div className="flex flex-wrap gap-2">
                            {interests.map(pref => (
                                <span
                                    key={pref.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-sm font-medium hover:bg-secondary transition-colors"
                                >
                                    <Hash className="h-3.5 w-3.5 text-primary" />
                                    {pref.tag}
                                </span>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        <Footer />
        </div>
    );
}

/* ======================================== */
/* HELPER COMPONENTS                        */
/* ======================================== */

function StatCard({ icon, label, value, sub, highlight }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    highlight?: boolean;
}) {
    return (
        <div className={`
      p-4 rounded-xl border transition-all
      ${highlight
                ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-sm shadow-primary/10'
                : 'border-border/50 bg-card hover:border-border'
            }
    `}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
    );
}

function Section({ title, icon, children }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="flex items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
            </div>
            {children}
        </div>
    );
}

function AccountCard({ icon, name, bgColor, username, profileUrl }: {
    icon: React.ReactNode;
    name: string;
    bgColor: string;
    username?: string | null;
    profileUrl?: string | null;
}) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-card-foreground/5 transition-colors group">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{name}</p>
                <p className="text-sm text-muted-foreground truncate font-medium">
                    {username || 'Connected'}
                </p>
            </div>
            {profileUrl && (
                <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 shrink-0 bg-secondary/50 hover:bg-secondary rounded-md text-secondary-foreground transition-colors opacity-0 group-hover:opacity-100"
                    title={`View ${name} Profile`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
            )}
        </div>
    );
}
