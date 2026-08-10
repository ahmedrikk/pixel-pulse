import { useMemo, useState } from "react";
import { Bell, CalendarDays, Gamepad2, Gift, MessageCircle, ScrollText, ThumbsUp } from "lucide-react";
import { formatDistanceToNowStrict, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type TalusNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Bell> = { comment_reply: MessageCircle, comment_vote: ThumbsUp, review_reply: MessageCircle, review_vote: ThumbsUp, esports_reminder: CalendarDays, free_game: Gift, game_launch: Gamepad2, game_patch: ScrollText };

function NotificationRow({ item, onOpen }: { item: TalusNotification; onOpen: () => void }) {
  const Icon = ICONS[item.type] ?? Bell;
  return <button type="button" onClick={onOpen} className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-secondary", !item.readAt && "bg-primary/[0.045]")}>
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-primary" />}<span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"><Icon className="h-3 w-3" /></span></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold normal-case">{item.title}</p>{item.message && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.message}</p>}<p className="mt-1 text-xs font-semibold text-primary">{formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}</p></div>
    {!item.readAt && <span className="mt-4 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
  </button>;
}

export default function Notifications() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const { data = [], isLoading } = useNotifications(user?.id);
  const markRead = useMarkNotificationRead(user?.id);
  const markAll = useMarkAllNotificationsRead(user?.id);
  const shown = tab === "unread" ? data.filter((item) => !item.readAt) : data;
  const groups = useMemo(() => ({ New: shown.filter((item) => isToday(new Date(item.createdAt))), Earlier: shown.filter((item) => !isToday(new Date(item.createdAt))) }), [shown]);
  const open = (item: TalusNotification) => { if (!item.readAt) markRead.mutate(item.id); if (item.link) navigate(item.link); };

  return <div className="min-h-screen pb-16 md:pb-0"><SiteLayout><main className="rounded-2xl border bg-card p-4 sm:p-5"><header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">Notifications</h1>{data.some((item) => !item.readAt) && <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>Mark All Read</Button>}</header>
    <div className="mt-3 flex gap-2"><button onClick={() => setTab("all")} className={cn("rounded-full px-4 py-2 text-sm font-semibold", tab === "all" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>All</button><button onClick={() => setTab("unread")} className={cn("rounded-full px-4 py-2 text-sm font-semibold", tab === "unread" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>Unread</button></div>
    {isLoading ? <div className="mt-5 space-y-2">{[1,2,3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-secondary" />)}</div> : shown.length === 0 ? <div className="py-20 text-center"><Bell className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-3 font-bold">You’re All Caught Up</h2><p className="mt-1 text-sm text-muted-foreground">Replies, reminders, free games, launches, and patches will appear here.</p></div> : <div className="mt-4 space-y-5">{Object.entries(groups).map(([label, items]) => items.length ? <section key={label}><h2 className="mb-1 px-3 text-sm font-bold">{label}</h2><div className="space-y-1">{items.map((item) => <NotificationRow key={item.id} item={item} onOpen={() => open(item)} />)}</div></section> : null)}</div>}
  </main><BottomNavBar /></SiteLayout></div>;
}
