import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [refCode, setRefCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref");
    if (r) {
      setRefCode(r.toUpperCase());
      localStorage.setItem("pending_ref", r.toUpperCase());
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    if (username.trim().length < 2) return toast.error("Name too short");
    if (refCode.trim()) localStorage.setItem("pending_ref", refCode.trim().toUpperCase());
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { username: username.trim(), ref_code: refCode.trim().toUpperCase() || null },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Check your email to confirm.");
    nav({ to: "/login" });
  };

  return (
    <AuthShell title={t("create_account")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("username")}</Label>
          <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 bg-secondary/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-secondary/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-secondary/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t("confirm_password")}</Label>
          <Input id="confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 bg-secondary/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ref">{lang === "bn" ? "রেফারেল কোড (ঐচ্ছিক)" : "Referral Code (optional)"}</Label>
          <Input id="ref" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="REFCODE" className="h-12 bg-secondary/50 border-border uppercase tracking-widest" />
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 shadow-glow">
          {busy ? t("signing_up") : t("create_account")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("have_account")}{" "}
        <Link to="/login" className="text-primary font-semibold">{t("login")}</Link>
      </p>
    </AuthShell>
  );
}
