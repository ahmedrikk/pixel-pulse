import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  FileText,
  Globe2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageSquareWarning,
  Shield,
  TerminalSquare,
  UserRound,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { supabase } from "@/integrations/supabase/client";

function SettingRow({ icon, label, value, onClick, to, accent = false }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  to?: string;
  accent?: boolean;
}) {
  const content = (
    <>
      <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span className={`flex-1 text-sm font-medium ${accent ? "text-primary" : ""}`}>{label}</span>
      {value && <span className="max-w-[45%] truncate text-xs text-muted-foreground">{value}</span>}
      {(onClick || to) && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </>
  );
  const className = "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/70";
  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button type="button" onClick={onClick} className={className} disabled={!onClick}>{content}</button>;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading } = useAuthGate();
  const [emailDialog, setEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate("/", { replace: true });
  }, [isLoading, navigate, user]);

  async function verifyEmail() {
    if (!user?.email) return;
    setSaving(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    setSaving(false);
    toast(error
      ? { title: "Verification email not sent", description: error.message, variant: "destructive" }
      : { title: "Verification email sent", description: "Check your inbox to finish verification." });
  }

  async function updateEmail() {
    if (!newEmail.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSaving(false);
    if (error) {
      toast({ title: "Email not updated", description: error.message, variant: "destructive" });
      return;
    }
    setEmailDialog(false);
    setNewEmail("");
    toast({ title: "Confirm your new email", description: "We sent confirmation instructions to the new address." });
  }

  async function resetPassword() {
    if (!user?.email) return;
    setSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/login` });
    setSaving(false);
    toast(error
      ? { title: "Reset email not sent", description: error.message, variant: "destructive" }
      : { title: "Password reset sent", description: "Check your email for the secure reset link." });
  }

  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteLayout>
        <main className="overflow-hidden rounded-xl border bg-card">
          <header className="flex items-center gap-3 border-b px-4 py-4 sm:px-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-xl font-bold">Account Settings</h1>
              <p className="text-xs text-muted-foreground">Security, email, policies, and account information</p>
            </div>
          </header>

          <div className="space-y-6 p-4 sm:p-6">
            <section>
              <h2 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Account</h2>
              <div className="rounded-xl border p-1">
                <SettingRow icon={<UserRound className="h-4 w-4" />} label="Profile" to="/profile" />
                <SettingRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email ?? ""} />
                {!user.email_confirmed_at && <SettingRow icon={<BadgeCheck className="h-4 w-4" />} label="Verify Your Email" onClick={verifyEmail} accent />}
                <SettingRow icon={<KeyRound className="h-4 w-4" />} label="Update Email" onClick={() => setEmailDialog(true)} />
                <SettingRow icon={<Lock className="h-4 w-4" />} label="Password" onClick={resetPassword} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">About</h2>
              <div className="rounded-xl border p-1">
                <SettingRow icon={<FileText className="h-4 w-4" />} label="Terms Of Service" to="/terms" />
                <SettingRow icon={<Shield className="h-4 w-4" />} label="Privacy Policy" to="/privacy" />
                <SettingRow icon={<Globe2 className="h-4 w-4" />} label="Status Page" value="All systems operational" />
                <SettingRow icon={<TerminalSquare className="h-4 w-4" />} label="System Log" value={`Web · ${navigator.platform || "Browser"}`} />
                <SettingRow icon={<MessageSquareWarning className="h-4 w-4" />} label="Send Error Report" onClick={() => window.location.assign("mailto:support@talus.gg?subject=Talus%20error%20report")} />
                <SettingRow icon={<BadgeCheck className="h-4 w-4" />} label="Version" value="Talus web beta" />
              </div>
            </section>

            <section className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <h2 className="text-sm font-bold text-destructive">Account Safety</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Account deactivation and permanent deletion require a verified support request while Talus is in beta, preventing accidental loss of reviews and profile data.</p>
              <a href="mailto:support@talus.gg?subject=Talus%20account%20request" className="mt-3 inline-flex text-sm font-semibold text-destructive hover:underline">Request Account Removal</a>
            </section>
          </div>
        </main>
      </SiteLayout>

      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Update Email</DialogTitle><DialogDescription>You will need to confirm the new address before it becomes active.</DialogDescription></DialogHeader>
          <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new@email.com" />
          <Button onClick={updateEmail} disabled={saving || !newEmail.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send Confirmation</Button>
        </DialogContent>
      </Dialog>
      <BottomNavBar />
    </div>
  );
}
