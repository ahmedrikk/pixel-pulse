import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AdminGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    void supabase.rpc("is_talus_admin").then(({ data, error }) => setState(!error && data ? "allowed" : "denied"));
  }, []);
  if (state === "checking") return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Verifying administrator access…</div>;
  if (state === "denied") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AdminAccessDenied() {
  return <div className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" />Administrator access required.</div>;
}
