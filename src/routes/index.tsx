import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Trophy, Wallet, Users } from "lucide-react";
import logo from "@/assets/ludo-coins-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen relative overflow-hidden flex flex-col px-6 py-8">
        {/* Glow accents */}
        <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute top-40 -right-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 animate-float-up">
          <img
            src={logo}
            alt="ChaleBid"
            className="h-44 w-44 object-contain mb-4 drop-shadow-[0_0_28px_oklch(0.55_0.22_18/0.55)]"
          />
          <p className="mt-1 text-muted-foreground">{t("tagline")}</p>

          <div className="grid grid-cols-3 gap-3 mt-10 w-full">
            <Feature icon={<Trophy className="h-5 w-5" />} label="Tournament" />
            <Feature icon={<Wallet className="h-5 w-5" />} label="Instant Pay" />
            <Feature icon={<Users className="h-5 w-5" />} label="Multiplayer" />
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3 relative z-10 pb-4">
          <Button asChild size="lg" className="w-full h-12 text-base shadow-glow">
            <Link to="/login">{t("login")}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full h-12 text-base">
            <Link to="/signup">{t("create_account")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card/60 border border-border">
      <div className="text-primary">{icon}</div>
      <span className="text-[11px] text-center text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}
