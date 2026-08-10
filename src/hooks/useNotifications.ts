import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TalusNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

async function fetchNotifications(userId: string): Promise<TalusNotification[]> {
  const { data, error } = await supabase.from("notifications").select("id,type,title,message,link,image_url,read_at,created_at").eq("user_id", userId).lte("available_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, type: item.type, title: item.title, message: item.message, link: item.link, imageUrl: item.image_url, readAt: item.read_at, createdAt: item.created_at }));
}

export function useNotifications(userId?: string) {
  return useQuery({ queryKey: ["notifications", userId], queryFn: () => fetchNotifications(userId!), enabled: !!userId, refetchInterval: 60_000, staleTime: 30_000 });
}

export function useMarkNotificationRead(userId?: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }, onSuccess: () => client.invalidateQueries({ queryKey: ["notifications", userId] }) });
}

export function useMarkAllNotificationsRead(userId?: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async () => { const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId!).is("read_at", null); if (error) throw error; }, onSuccess: () => client.invalidateQueries({ queryKey: ["notifications", userId] }) });
}
