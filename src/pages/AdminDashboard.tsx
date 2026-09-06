import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Activity, Bot, CalendarDays, Check, Clock3, Database, FileCheck2, Gamepad2, Gift, Newspaper, RefreshCw, Settings, ShieldCheck, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
type DashboardData = {
  generatedAt: string;
  overview: Record<string, number | string>;
  news: Row[]; recentContent: Row[]; youtubeSources: Row[]; games: Row[];
  freeGames: Row[]; patches: Row[]; moderation: Row[]; users: Row[];
  usage: Row[]; jobs: Row[]; pacingRuns: Row[]; settings: Row[]; audit: Row[];
};

const sections = [
  ["overview", "Overview", Activity], ["news", "News", Newspaper], ["youtube", "YouTube", Bot],
  ["games", "Games", Gamepad2], ["free", "Free Games", Gift], ["patches", "Patch Bot", FileCheck2],
  ["calendar", "Calendar", CalendarDays], ["moderation", "Moderation", ShieldCheck],
  ["users", "Users", Users], ["operations", "Usage & Jobs", Database], ["settings", "Settings & Audit", Settings],
] as const;

function text(value: unknown) { return value == null ? "—" : String(value); }
function when(value: unknown) {
  if (!value) return "Never";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? text(value) : `${formatDistanceToNowStrict(date)} ago`;
}
function Status({ value }: { value: unknown }) {
  const label = text(value);
  const good = /healthy|active|ready|complete|approved|success|true/i.test(label);
  const bad = /failed|error|missing|rejected|degraded|false/i.test(label);
  return <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", good && "bg-emerald-500/15 text-emerald-600", bad && "bg-red-500/15 text-red-600", !good && !bad && "bg-secondary text-muted-foreground")}>{label}</span>;
}
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card"><div className="border-b p-4"><h2 className="text-lg font-bold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div><div className="overflow-x-auto p-4">{children}</div></section>;
}
function DataTable({ rows, columns }: { rows: Row[]; columns: Array<[string, string, "status" | "time" | "text"?]> }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No records in this view.</p>;
  return <table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">{columns.map(([key,label])=><th key={key} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={text(row.id ?? row.key ?? index)} className="border-b last:border-0">{columns.map(([key,,kind])=><td key={key} className="max-w-sm px-3 py-3 align-top">{kind === "status" ? <Status value={row[key]} /> : kind === "time" ? when(row[key]) : <span className="line-clamp-3">{text(row[key])}</span>}</td>)}</tr>)}</tbody></table>;
}
function Metric({ label, value }: { label: string; value: unknown }) { return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{text(value)}</p></div>; }

export default function AdminDashboard() {
  const client = useQueryClient();
  const [active, setActive] = useState("overview");
  const query = useQuery({
    queryKey: ["talus-admin-dashboard"],
    queryFn: async () => { const { data,error } = await supabase.rpc("get_talus_admin_dashboard"); if(error) throw error; return data as unknown as DashboardData; },
    refetchInterval: 60_000,
  });
  const moderate = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => { const { error } = await supabase.rpc("admin_moderate_game_description", { p_submission_id:id,p_decision:decision,p_notes:null,p_edited_description:null }); if(error) throw error; },
    onSuccess: () => { toast.success("Moderation decision saved."); void client.invalidateQueries({ queryKey:["talus-admin-dashboard"] }); },
    onError: () => toast.error("Couldn’t save that decision."),
  });
  const data = query.data;
  const incompleteGames = useMemo(() => data?.games.filter((game) => game.description_status !== "ready" || game.image_status !== "real" || !game.release_date) ?? [], [data]);
  if (query.isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><RefreshCw className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"><div className="w-full max-w-md rounded-xl border bg-card p-6 text-center"><h1 className="text-xl font-bold">Dashboard Temporarily Unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Talus couldn’t load the operations data. Your administrator access is still active.</p><Button className="mt-5" onClick={()=>query.refetch()} disabled={query.isFetching}><RefreshCw className={cn("mr-2 h-4 w-4",query.isFetching&&"animate-spin")}/>Try Again</Button></div></div>;
  const o=data.overview;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/><h1 className="text-xl font-black">Talus Operations</h1><Status value={o.systemStatus}/></div><p className="text-xs text-muted-foreground">Updated {when(data.generatedAt)}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>query.refetch()} disabled={query.isFetching}><RefreshCw className={cn("mr-2 h-4 w-4",query.isFetching&&"animate-spin")}/>Refresh</Button><Button asChild variant="ghost" size="sm"><Link to="/">Public site</Link></Button></div></div></header>
    <Tabs value={active} onValueChange={setActive} className="mx-auto max-w-[1600px] p-4">
      <TabsList className="mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto p-2">{sections.map(([id,label,Icon])=><TabsTrigger key={id} value={id} className="gap-2"><Icon className="h-4 w-4"/>{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="overview" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Articles today" value={o.articlesToday}/><Metric label="Videos today" value={o.videosToday}/><Metric label="Live free games" value={o.activeFreeGames}/><Metric label="Patches today" value={o.patchesToday}/><Metric label="API failures · 24h" value={o.apiFailures24h}/><Metric label="Complete games" value={`${o.gamesComplete}/${o.gamesTotal}`}/><Metric label="Pending descriptions" value={o.pendingDescriptions}/><Metric label="Users" value={o.usersTotal}/></div><Panel title="Recent publishing activity"><DataTable rows={data.recentContent.slice(0,12)} columns={[["source","Source"],["media_type","Type","status"],["title","Talus headline"],["created_at","Published","time"]]}/></Panel><Panel title="Recent scheduler runs"><DataTable rows={data.pacingRuns.slice(0,12)} columns={[["slot_started_at","Started","time"],["granted_allowance","Allowance"],["published_count","Published"],["completed_at","Completed","time"]]}/></Panel></TabsContent>
      <TabsContent value="news" className="space-y-4"><Panel title="Website source distribution" subtitle="Seven-day volume makes source imbalance visible."><DataTable rows={data.news.filter(r=>r.media_type!=="youtube")} columns={[["source","Source"],["total","Published"],["last_published","Last published","time"]]}/></Panel><Panel title="Latest website briefs"><DataTable rows={data.recentContent.filter(r=>r.media_type!=="youtube")} columns={[["source","Source"],["title","Talus headline"],["summary","Summary"],["created_at","Published","time"]]}/></Panel></TabsContent>
      <TabsContent value="youtube" className="space-y-4"><Panel title="YouTube channels"><DataTable rows={data.youtubeSources} columns={[["source_name","Channel"],["active","Enabled","status"],["poll_interval_minutes","Interval (min)"],["quota_units_used_today","Quota today"],["last_polled_at","Last checked","time"]]}/></Panel><Panel title="Latest video briefs"><DataTable rows={data.recentContent.filter(r=>r.media_type==="youtube")} columns={[["source","Channel"],["title","Talus headline"],["summary","Summary"],["created_at","Published","time"]]}/></Panel></TabsContent>
      <TabsContent value="games" className="space-y-4"><Panel title="Canonical game records" subtitle="Prioritized by trending status and reviews."><DataTable rows={data.games} columns={[["name","Game"],["description_status","Description","status"],["image_status","Image","status"],["release_date","Release date"],["review_count","Reviews"],["updated_at","Updated","time"]]}/></Panel><Panel title="Needs attention"><DataTable rows={incompleteGames} columns={[["name","Game"],["description_status","Description","status"],["image_status","Image","status"],["release_date","Release date"]]}/></Panel></TabsContent>
      <TabsContent value="free"><Panel title="Free-game offer health" subtitle="Unconfirmed offers are expired instead of remaining falsely active."><DataTable rows={data.freeGames} columns={[["source_name","Source"],["store_name","Store"],["status","Status","status"],["ends_at","Ends","time"],["last_seen_at","Last verified","time"]]}/></Panel></TabsContent>
      <TabsContent value="patches"><Panel title="Patch processing"><DataTable rows={data.patches} columns={[["game_id","Game"],["title","Patch"],["editorial_status","Rewrite","status"],["editorial_error","Error"],["published_at","Published","time"]]}/></Panel></TabsContent>
      <TabsContent value="calendar" className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Games with dates" value={data.games.filter(g=>g.release_date).length}/><Metric label="Dates missing" value={data.games.filter(g=>!g.release_date).length}/><Metric label="Records sampled" value={data.games.length}/></div><Panel title="Release data quality"><DataTable rows={data.games} columns={[["name","Game"],["release_date","Release date"],["image_status","Image","status"],["updated_at","Updated","time"]]}/></Panel></TabsContent>
      <TabsContent value="moderation"><Panel title="Community description queue" subtitle="Approvals publish to the canonical Game record and every decision is audited.">{data.moderation.length ? <div className="space-y-3">{data.moderation.map(row=><article key={text(row.id)} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{text(row.game_name)}</h3><p className="text-xs text-muted-foreground">Submitted {when(row.created_at)}</p></div><Status value={row.status}/></div><p className="mt-3 whitespace-pre-line text-sm leading-6">{text(row.description)}</p>{row.status==="pending"&&<div className="mt-4 flex gap-2"><Button size="sm" onClick={()=>moderate.mutate({id:text(row.id),decision:"approved"})}><Check className="mr-2 h-4 w-4"/>Approve</Button><Button size="sm" variant="destructive" onClick={()=>moderate.mutate({id:text(row.id),decision:"rejected"})}><X className="mr-2 h-4 w-4"/>Reject</Button></div>}</article>)}</div>:<p className="py-8 text-center text-sm text-muted-foreground">Moderation queue is clear.</p>}</Panel></TabsContent>
      <TabsContent value="users"><Panel title="Accounts" subtitle="Emails are masked; secrets and sessions are never returned."><DataTable rows={data.users} columns={[["display_name","Name"],["username","Username"],["masked_email","Email"],["account_status","Status","status"],["onboarding_completed","Onboarded","status"],["is_admin","Admin","status"],["last_sign_in_at","Last login","time"]]}/></Panel></TabsContent>
      <TabsContent value="operations" className="space-y-4"><Panel title="API and AI usage · 24 hours"><DataTable rows={data.usage} columns={[["provider","Provider"],["service","Service"],["operation","Operation"],["requests","Requests"],["failures","Failures"],["total_tokens","Tokens"],["average_latency_ms","Avg. latency"]]}/></Panel><Panel title="Recurring jobs"><DataTable rows={data.jobs} columns={[["jobname","Job"],["schedule","Schedule"],["active","Active","status"]]}/></Panel></TabsContent>
      <TabsContent value="settings" className="space-y-4"><Panel title="Safe configuration"><DataTable rows={data.settings} columns={[["key","Setting"],["value","Value"],["description","Purpose"],["updated_at","Updated","time"]]}/></Panel><Panel title="Immutable audit history"><DataTable rows={data.audit} columns={[["action","Action"],["entity_type","Entity"],["entity_id","Record"],["created_at","When","time"]]}/></Panel></TabsContent>
    </Tabs>
  </div>;
}
