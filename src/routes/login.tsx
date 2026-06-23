import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("welcome_back"));
    nav({ to: "/home" });
  };

  const onGuest = async () => {
    setGuestBusy(true);
    const guestEmail = `guest_${Date.now()}@guest.local`;
    const guestPassword = `Guest!${Math.random().toString(36).slice(2, 10)}Aa1`;
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: { is_guest: true, display_name: `Guest${Math.floor(Math.random() * 9999)}` },
        },
      });
      if (signUpErr) throw signUpErr;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: guestEmail,
        password: guestPassword,
      });
      if (signInErr) throw signInErr;
      toast.success("Guest login successful");
      nav({ to: "/home" });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Guest login failed — email confirmation must be disabled",
      );
    } finally {
      setGuestBusy(false);
    }
  };

  return (
    <AuthShell title={t("login")} subtitle={t("welcome_back")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-secondary/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-secondary/50 border-border" />
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary">{t("forgot_password")}</Link>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 shadow-glow">
          {busy ? t("signing_in") : t("login")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGuest}
        disabled={guestBusy}
        className="w-full h-12 border-dashed"
      >
        {guestBusy ? "..." : "🎮 Continue as Guest (Test)"}
      </Button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("no_account")}{" "}
        <Link to="/signup" className="text-primary font-semibold">{t("create_account")}</Link>
      </p>
    </AuthShell>
  );
}
