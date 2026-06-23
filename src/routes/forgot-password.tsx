import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Mail, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success(t("reset_email_sent"));
  };

  return (
    <div className="min-h-svh flex flex-col px-5 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav({ to: "/login" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t("reset_password")}</h1>
      </div>

      <Card className="p-5 space-y-4">
        {sent ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div className="font-semibold">{t("reset_email_sent")}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
            <Button variant="outline" onClick={() => setSent(false)} className="w-full">
              {lang === "bn" ? "অন্য ইমেইল ব্যবহার" : "Use another email"}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {lang === "bn"
                ? "আপনার ইমেইল দিন — আমরা পাসওয়ার্ড রিসেট লিংক পাঠাব।"
                : "Enter your email — we'll send you a password reset link."}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("email")}</Label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : t("send_reset_link")}
            </Button>
          </form>
        )}
      </Card>

      <Link to="/login" className="text-center text-sm text-primary mt-4">
        {t("back_to_login")}
      </Link>
    </div>
  );
}
