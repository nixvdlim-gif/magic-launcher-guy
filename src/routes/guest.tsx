import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Check, X, UserCircle2, Trophy, Eye, Gamepad2, Wallet, ArrowDownToLine, Coins } from "lucide-react";

export const Route = createFileRoute("/guest")({
  component: GuestPage,
});

function GuestPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const continueAsGuest = async () => {
    setBusy(true);
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
      toast.error(e instanceof Error ? e.message : "Guest login failed");
    } finally {
      setBusy(false);
    }
  };

  const can = [
    { icon: <Gamepad2 className="h-4 w-4" />, text: "Browse all games" },
    { icon: <Trophy className="h-4 w-4" />, text: "View leaderboard" },
    { icon: <Eye className="h-4 w-4" />, text: "Practice mode" },
  ];

  const cannot = [
    { icon: <Wallet className="h-4 w-4" />, text: "Deposit cash" },
    { icon: <ArrowDownToLine className="h-4 w-4" />, text: "Withdraw money" },
    { icon: <Coins className="h-4 w-4" />, text: "Play real money games" },
  ];

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen flex flex-col px-5 pt-6 pb-8 relative overflow-hidden">
        <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="absolute top-40 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-2 relative z-10">
          <button onClick={() => nav({ to: "/login" })} className="p-1 -ml-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Guest Mode</h1>
        </div>

        <div className="flex-1 flex flex-col gap-5 relative z-10">
          <div className="flex flex-col items-center text-center mt-4 animate-float-up">
            <div className="h-24 w-24 rounded-full bg-gradient-secondary shadow-glow-violet flex items-center justify-center mb-3">
              <UserCircle2 className="h-14 w-14 text-secondary-foreground" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Playing as Guest
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Explore the app with limited features
            </p>
          </div>

          <Card className="p-4 space-y-2.5 glass-rim">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
              ✓ What you CAN do
            </div>
            {can.map((it, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center"><Check className="h-4 w-4" /></span>
                <span className="text-foreground/90">{it.text}</span>
                <span className="ml-auto text-muted-foreground">{it.icon}</span>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-2.5 border-destructive/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">
              ✗ What you CANNOT do
            </div>
            {cannot.map((it, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="h-7 w-7 rounded-full bg-destructive/15 text-destructive flex items-center justify-center"><X className="h-4 w-4" /></span>
                <span className="text-foreground/90">{it.text}</span>
                <span className="ml-auto text-muted-foreground">{it.icon}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-3 mt-5 relative z-10">
          <Button asChild size="lg" className="w-full h-12 text-base shadow-glow">
            <Link to="/login">
              Login to Unlock Everything
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={continueAsGuest}
            className="w-full h-12 text-sm"
          >
            {busy ? "..." : "Continue as Guest"}
          </Button>
        </div>
      </div>
    </div>
  );
}