import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Copy, Share2, Users, Coins, TrendingUp, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const c = useCurrency();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [referredCount, setReferredCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [topReferrers, setTopReferrers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: earn }, { count }] = await Promise.all([
        supabase.from("profiles").select("id, username, game_id, avatar_url, level, total_wins, total_losses, total_games, is_verified, referred_by, created_at").eq("id", user.id).single(),
        supabase.from("referral_earnings").select("*").eq("earner_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", user.id),
      ]);
      setProfile(prof);
      setEarnings(earn ?? []);
      setReferredCount(count ?? 0);
      setTotalEarned((earn ?? []).reduce((s: number, r: any) => s + Number(r.commission_earned), 0));

      // My referred users
      const { data: refs } = await supabase
        .from("profiles")
        .select("id, username, game_id, avatar_url, created_at")
        .eq("referred_by", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setReferredUsers(refs ?? []);

      // Top referrers leaderboard (aggregate referral_earnings)
      const { data: allEarn } = await supabase
        .from("referral_earnings")
        .select("earner_id, commission_earned");
      const byUser: Record<string, number> = {};
      (allEarn ?? []).forEach((r: any) => {
        byUser[r.earner_id] = (byUser[r.earner_id] ?? 0) + Number(r.commission_earned);
      });
      const top = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const topIds = top.map(([id]) => id);
      let topProfs: Record<string, any> = {};
      if (topIds.length) {
        const { data: tp } = await supabase.from("profiles").select("id, username, avatar_url, game_id").in("id", topIds);
        topProfs = Object.fromEntries((tp ?? []).map((p: any) => [p.id, p]));
      }
      setTopReferrers(top.map(([id, total]) => ({ id, total, profile: topProfs[id] })));
      setLoading(false);
    })();
  }, [user]);

  const code = profile?.game_id ?? "";
  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${code}` : "";

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(t("copied"));
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: t("app_name"),
          text: lang === "bn" ? `আমার রেফারেল কোড: ${code}` : `Use my referral code: ${code}`,
          url: link,
        });
      } catch { /* user cancelled */ }
    } else {
      copy(link);
    }
  };

  return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/profile" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t("refer_earn")}</h1>
      </div>

      {/* Code card */}
      <Card className="p-5 bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30 text-center space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("my_referral_code")}</div>
        <div className="text-3xl font-mono font-bold tracking-widest">{code || "------"}</div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => copy(code)}>
            <Copy className="h-4 w-4 mr-2" /> {lang === "bn" ? "কোড" : "Code"}
          </Button>
          <Button className="flex-1" onClick={share}>
            <Share2 className="h-4 w-4 mr-2" /> {t("share")}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <Users className="h-5 w-5 text-primary mb-1" />
          <div className="text-2xl font-bold">{referredCount}</div>
          <div className="text-[11px] text-muted-foreground">{t("total_referred")}</div>
        </Card>
        <Card className="p-4">
          <Coins className="h-5 w-5 text-accent mb-1" />
          <div className="text-2xl font-bold">{c}{totalEarned.toFixed(0)}</div>
          <div className="text-[11px] text-muted-foreground">{t("total_earned")}</div>
        </Card>
      </div>

      {/* Commission rates */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> {t("commission_rates")}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { lvl: 1, pct: 5 },
            { lvl: 2, pct: 2 },
            { lvl: 3, pct: 1 },
          ].map((r) => (
            <div key={r.lvl} className="rounded-xl bg-card/50 py-3">
              <div className="text-lg font-bold text-primary">{r.pct}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">L{r.lvl}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Earnings history */}
      <div>
        <div className="text-sm font-semibold mb-2">{t("earnings_history")}</div>
        {loading ? (
          <Card className="p-4 text-sm text-muted-foreground">…</Card>
        ) : earnings.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("no_referrals")}</Card>
        ) : (
          <div className="space-y-2">
            {earnings.map((e) => (
              <Card key={e.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">L{e.level} • {e.commission_percent}%</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">+{c}{Number(e.commission_earned).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {lang === "bn" ? "ডিপোজিট" : "deposit"} {c}{Number(e.deposit_amount).toFixed(0)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* My referred users */}
      {referredUsers.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Users className="h-4 w-4" /> {lang === "bn" ? "আপনার রেফার্ড সদস্য" : "Your Referrals"} ({referredUsers.length})
          </div>
          <div className="space-y-1.5">
            {referredUsers.map((r) => (
              <Card key={r.id} className="p-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold overflow-hidden">
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (r.username?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.username}</div>
                  <div className="text-[10px] text-muted-foreground">#{r.game_id}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top referrers leaderboard */}
      <div>
        <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-yellow-500" /> {lang === "bn" ? "টপ রেফারার" : "Top Referrers"}
        </div>
        {topReferrers.length === 0 ? (
          <Card className="p-4 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "এখনও কোনো ডেটা নেই" : "No data yet"}
          </Card>
        ) : (
          <div className="space-y-1">
            {topReferrers.map((r, i) => {
              const isMe = r.id === user?.id;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <Card key={r.id} className={`p-2 flex items-center gap-2 ${isMe ? "border-primary bg-primary/5" : ""}`}>
                  <div className="w-7 text-center text-sm font-bold">
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold overflow-hidden">
                    {r.profile?.avatar_url
                      ? <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (r.profile?.username?.[0]?.toUpperCase() ?? "?")}
                  </div>
                  <div className="flex-1 text-sm font-semibold truncate">
                    {r.profile?.username ?? "Player"} {isMe && <span className="text-[10px] text-primary">({lang === "bn" ? "আপনি" : "you"})</span>}
                  </div>
                  <div className="text-sm font-bold text-primary">{c}{Number(r.total).toFixed(0)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
