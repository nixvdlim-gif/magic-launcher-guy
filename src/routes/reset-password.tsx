import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) return toast.error(lang === "bn" ? "কমপক্ষে ৬ অক্ষর" : "At least 6 characters");
    if (pwd !== confirm) return toast.error(lang === "bn" ? "পাসওয়ার্ড মিলেনি" : "Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success(t("password_updated"));
    setTimeout(() => nav({ to: "/home" }), 1500);
  };

  return (
    <div className="min-h-svh flex flex-col px-5 pt-10 pb-8">
      <h1 className="text-2xl font-bold mb-6">{t("reset_password")}</h1>
      <Card className="p-5">
        {done ? (
          <div className="text-center space-y-2 py-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div className="font-semibold">{t("password_updated")}</div>
          </div>
        ) : !hasSession ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-sm text-muted-foreground">
              {lang === "bn"
                ? "অবৈধ বা মেয়াদোত্তীর্ণ লিংক। আবার রিসেট লিংক চান।"
                : "Invalid or expired link. Request a new reset link."}
            </div>
            <Link to="/forgot-password" className="block">
              <Button variant="outline" className="w-full">{t("reset_password")}</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">{t("new_password")}</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("confirm_password")}</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : t("change_password")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
