import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useRoles } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, LogOut, Shield, ChevronRight, Gift, Settings as SettingsIcon, Wallet as WalletIcon, History, HeadphonesIcon, Trophy, Gamepad2, Award, MessageCircle, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [showClaimAdmin, setShowClaimAdmin] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "show_claim_admin").maybeSingle()
      .then(({ data }) => setShowClaimAdmin(Boolean((data?.value as any)?.enabled)));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, username, avatar_url, level, total_wins, total_losses, total_games, game_id, is_verified, is_blocked, language, referred_by, created_at")
        .eq("id", user.id).single();
      const { data: phone } = await supabase.rpc("get_my_phone");
      setProfile(data ? { ...data, phone } : null);
    })();
  }, [user]);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(t("copied"));
  };

  const claimAdmin = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_first_admin");
    setClaiming(false);
    if (error) return toast.error(error.message);
    if (data === "granted") {
      toast.success(t("admin_claimed"));
      window.location.reload();
    } else {
      toast.info(t("admin_exists"));
    }
  };

  const onLogout = async () => {
    await signOut();
    nav({ to: "/" });
  };

  return (
    <div className="px-5 pt-8 space-y-5">
      <h1 className="text-2xl font-bold">{t("profile")}</h1>

      <Card className="p-5 bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/30 flex items-center justify-center text-2xl font-bold">
            {profile?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">{profile?.username ?? "…"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
            <button onClick={() => profile && copy(profile.game_id)} className="mt-1 text-xs flex items-center gap-1 text-primary">
              {t("game_id")}: <span className="font-mono">{profile?.game_id ?? "------"}</span> <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <Stat label={t("level")} value={profile?.level ?? 1} />
          <Stat label={t("wins")} value={profile?.total_wins ?? 0} />
          <Stat label={t("total_games")} value={profile?.total_games ?? 0} />
        </div>
      </Card>

      {/* Admin entry */}
      {!rolesLoading && isAdmin && (
        <button onClick={() => nav({ to: "/admin" })} className="w-full">
          <Card className="p-4 hover:bg-accent/10 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-medium">{t("admin_panel")}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </button>
      )}


      {/* Referral */}
      <NavRow icon={<Gift className="h-5 w-5 text-accent" />} label={t("refer_earn")} onClick={() => nav({ to: "/referral" })} />
      <NavRow icon={<Award className="h-5 w-5 text-primary" />} label="Levels & Achievements" onClick={() => nav({ to: "/levels" })} />
      <NavRow icon={<Trophy className="h-5 w-5 text-yellow-500" />} label="Tournaments" onClick={() => nav({ to: "/tournaments" })} />
      <NavRow icon={<MessageCircle className="h-5 w-5 text-primary" />} label="Community Chat" onClick={() => nav({ to: "/chat" })} />
      <NavRow icon={<ShoppingBag className="h-5 w-5 text-accent" />} label="Emoji Shop" onClick={() => nav({ to: "/emoji-shop" })} />
      <NavRow icon={<Gamepad2 className="h-5 w-5 text-muted-foreground" />} label="Game History" onClick={() => nav({ to: "/history" })} />
      {/* Transactions */}
      <NavRow icon={<History className="h-5 w-5 text-muted-foreground" />} label={t("transactions")} onClick={() => nav({ to: "/transactions" })} />
      {/* Wallet */}
      <NavRow icon={<WalletIcon className="h-5 w-5 text-muted-foreground" />} label={t("wallet")} onClick={() => nav({ to: "/wallet" })} />
      {/* Settings */}
      <NavRow icon={<SettingsIcon className="h-5 w-5 text-muted-foreground" />} label={t("settings")} onClick={() => nav({ to: "/settings" })} />
      <NavRow icon={<HeadphonesIcon className="h-5 w-5 text-muted-foreground" />} label={t("support")} onClick={() => nav({ to: "/support" })} />

      {/* Claim first admin (only show if no admin yet) */}
      {!rolesLoading && !isAdmin && showClaimAdmin && (
        <Button variant="outline" onClick={claimAdmin} disabled={claiming} className="w-full">
          <Shield className="h-4 w-4 mr-2" />
          {claiming ? "…" : t("claim_admin")}
        </Button>
      )}

      <Button variant="destructive" onClick={onLogout} className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        {t("logout")}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-card/50 py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function NavRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full">
      <Card className="p-4 hover:bg-accent/10 transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-medium">{label}</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </Card>
    </button>
  );
}
