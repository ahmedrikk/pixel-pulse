import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImageOff, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Article = {
  id: string;
  source: string;
  source_url: string;
  source_title: string;
  headline: string;
  summary: string;
  image_url: string;
  article_date: string;
  visible: boolean;
};

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  description_status: string;
  image_status: string;
  review_count: number;
  updated_at: string | null;
};

type ListResult<T> = { items: T[]; total: number };

function asList<T>(value: unknown): ListResult<T> {
  if (!value || typeof value !== "object") return { items: [], total: 0 };
  const result = value as { items?: unknown; total?: unknown };
  return {
    items: Array.isArray(result.items) ? result.items as T[] : [],
    total: Number(result.total ?? 0),
  };
}

function ImagePreview({ src, alt }: { src: string | null; alt: string }) {
  return src ? <img src={src} alt={alt} className="h-20 w-32 rounded-lg border object-cover" /> : <div className="flex h-20 w-32 items-center justify-center rounded-lg border bg-muted"><ImageOff className="h-5 w-5 text-muted-foreground" /></div>;
}

export function NewsContentEditor() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Article | null>(null);
  const [draft, setDraft] = useState({ headline: "", summary: "", imageUrl: "", visible: true });
  const pageSize = 30;

  useEffect(() => setPage(0), [search]);
  const query = useQuery({
    queryKey: ["admin-editable-news", search, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_articles", { p_search: search || null, p_limit: pageSize, p_offset: page * pageSize });
      if (error) throw error;
      return asList<Article>(data);
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.rpc("admin_update_article", {
        p_article_id: editing.id,
        p_headline: draft.headline,
        p_summary: draft.summary,
        p_image_url: draft.imageUrl,
        p_visible: draft.visible,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("News card updated.");
      setEditing(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-editable-news"] }),
        client.invalidateQueries({ queryKey: ["talus-admin-dashboard"] }),
        client.invalidateQueries({ queryKey: ["gaming-news"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Couldn’t update that news card."),
  });
  const open = (article: Article) => {
    setEditing(article);
    setDraft({ headline: article.headline, summary: article.summary, imageUrl: article.image_url ?? "", visible: article.visible });
  };
  const result = query.data ?? { items: [], total: 0 };

  return <>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search headline or source" className="pl-9" /></div>
      <span className="text-sm text-muted-foreground">{result.total.toLocaleString()} website articles</span>
    </div>
    {query.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading published news…</p> : result.items.length ? <div className="space-y-3">{result.items.map((article) => <article key={article.id} className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row">
      <ImagePreview src={article.image_url} alt="" />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{article.source}</span><span>•</span><span>{new Date(article.article_date).toLocaleDateString()}</span><span className={article.visible ? "text-emerald-600" : "text-amber-600"}>{article.visible ? "Published" : "Hidden from feed"}</span></div><h3 className="mt-1 font-bold">{article.headline}</h3><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p></div>
      <div className="flex shrink-0 gap-2"><Button asChild size="sm" variant="ghost"><a href={article.source_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /><span className="sr-only">Open source</span></a></Button><Button size="sm" variant="outline" onClick={() => open(article)}><Pencil className="mr-2 h-4 w-4" />Edit</Button></div>
    </article>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No matching news cards.</p>}
    <div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}>Newer</Button><span className="text-xs text-muted-foreground">Page {page + 1}</span><Button variant="outline" disabled={(page + 1) * pageSize >= result.total || query.isFetching} onClick={() => setPage((value) => value + 1)}>Older</Button></div>

    <Dialog open={Boolean(editing)} onOpenChange={(openState) => !openState && setEditing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Edit published news card</DialogTitle><DialogDescription>The Talus headline, summary, image, and live-feed visibility update without changing the original source article.</DialogDescription></DialogHeader>
      <div className="space-y-4"><div className="space-y-2"><Label htmlFor="news-headline">Headline</Label><Input id="news-headline" maxLength={180} value={draft.headline} onChange={(event) => setDraft((value) => ({ ...value, headline: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{draft.headline.length}/180</p></div>
      <div className="space-y-2"><Label htmlFor="news-summary">Summary</Label><Textarea id="news-summary" rows={7} maxLength={1200} value={draft.summary} onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{draft.summary.trim() ? draft.summary.trim().split(/\s+/).length : 0} words</p></div>
      <div className="space-y-2"><Label htmlFor="news-image">Image URL</Label><Input id="news-image" type="url" placeholder="https://…" value={draft.imageUrl} onChange={(event) => setDraft((value) => ({ ...value, imageUrl: event.target.value }))} />{draft.imageUrl && <ImagePreview src={draft.imageUrl} alt="News card preview" />}</div>
      <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="news-visible">Published in feed</Label><p className="text-xs text-muted-foreground">Turn off to remove this card from public ranking and resurfacing.</p></div><Switch id="news-visible" checked={draft.visible} onCheckedChange={(checked) => setDraft((value) => ({ ...value, visible: checked }))} /></div></div>
      <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

export function GameContentEditor() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Game | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", coverImage: "", genres: "", platforms: "", releaseDate: "", developer: "", publisher: "" });
  const pageSize = 30;

  useEffect(() => setPage(0), [search]);
  const query = useQuery({
    queryKey: ["admin-editable-games", search, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_games", { p_search: search || null, p_limit: pageSize, p_offset: page * pageSize });
      if (error) throw error;
      return asList<Game>(data);
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
      const { error } = await supabase.rpc("admin_update_game", {
        p_game_id: editing.id,
        p_name: draft.name,
        p_description: draft.description,
        p_cover_image: draft.coverImage,
        p_genres: split(draft.genres),
        p_platforms: split(draft.platforms),
        p_release_date: draft.releaseDate || null,
        p_developer: draft.developer,
        p_publisher: draft.publisher,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Game page updated.");
      setEditing(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-editable-games"] }),
        client.invalidateQueries({ queryKey: ["talus-admin-dashboard"] }),
        client.invalidateQueries({ queryKey: ["games"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Couldn’t update that game."),
  });
  const open = (game: Game) => {
    setEditing(game);
    setDraft({ name: game.name, description: game.description ?? "", coverImage: game.cover_image ?? "", genres: (game.genres ?? []).join(", "), platforms: (game.platforms ?? []).join(", "), releaseDate: game.release_date ?? "", developer: game.developer ?? "", publisher: game.publisher ?? "" });
  };
  const result = query.data ?? { items: [], total: 0 };

  return <>
    <div className="mb-4 flex flex-wrap items-center gap-3"><div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search canonical games" className="pl-9" /></div><span className="text-sm text-muted-foreground">{result.total.toLocaleString()} games</span></div>
    {query.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading games…</p> : result.items.length ? <div className="space-y-3">{result.items.map((game) => <article key={game.id} className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row"><ImagePreview src={game.cover_image} alt="" /><div className="min-w-0 flex-1"><h3 className="font-bold">{game.name}</h3><p className="text-xs text-muted-foreground">{game.developer || "Developer missing"} · {game.release_date || "Release date missing"}</p><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{game.description || "No editorial description yet."}</p></div><div className="flex shrink-0 gap-2"><Button asChild size="sm" variant="ghost"><a href={`/reviews/${encodeURIComponent(game.slug || game.id)}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /><span className="sr-only">Open game page</span></a></Button><Button size="sm" variant="outline" onClick={() => open(game)}><Pencil className="mr-2 h-4 w-4" />Edit</Button></div></article>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No matching games.</p>}
    <div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page === 0 || query.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><span className="text-xs text-muted-foreground">Page {page + 1}</span><Button variant="outline" disabled={(page + 1) * pageSize >= result.total || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button></div>

    <Dialog open={Boolean(editing)} onOpenChange={(openState) => !openState && setEditing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Edit game information page</DialogTitle><DialogDescription>Changes update the canonical Talus game page and its search preview metadata.</DialogDescription></DialogHeader>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="game-name">Game name</Label><Input id="game-name" maxLength={140} value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="game-release">Release date</Label><Input id="game-release" type="date" value={draft.releaseDate} onChange={(event) => setDraft((value) => ({ ...value, releaseDate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="game-developer">Developer</Label><Input id="game-developer" maxLength={240} value={draft.developer} onChange={(event) => setDraft((value) => ({ ...value, developer: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="game-publisher">Publisher</Label><Input id="game-publisher" maxLength={240} value={draft.publisher} onChange={(event) => setDraft((value) => ({ ...value, publisher: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="game-genres">Genres</Label><Input id="game-genres" placeholder="Action, RPG" value={draft.genres} onChange={(event) => setDraft((value) => ({ ...value, genres: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="game-platforms">Platforms</Label><Input id="game-platforms" placeholder="PC, PlayStation 5" value={draft.platforms} onChange={(event) => setDraft((value) => ({ ...value, platforms: event.target.value }))} /></div></div>
      <div className="space-y-2"><Label htmlFor="game-cover">Cover image URL</Label><Input id="game-cover" value={draft.coverImage} onChange={(event) => setDraft((value) => ({ ...value, coverImage: event.target.value }))} />{draft.coverImage && <ImagePreview src={draft.coverImage} alt="Game cover preview" />}</div>
      <div className="space-y-2"><Label htmlFor="game-description">Editorial description</Label><Textarea id="game-description" rows={12} maxLength={12000} value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{draft.description.length}/12000</p></div>
      <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save game page"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
