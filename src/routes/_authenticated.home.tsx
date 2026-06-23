import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, ArrowDownToLine, Gift, HeadphonesIcon, Trophy, Gamepad2, Bell, Copy, Sparkles, TrendingUp, TrendingDown, Circle, Megaphone, X, Clock, Users, Star, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Dices } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

type Profile = { username: string | null; game_id: string | null; avatar_url: string | null; total_wins?: number | null };
type Balance = { deposit: number; winnings: number };

const LEVEL_TIERS = [
  { n: 1, wins: 0 },
  { n: 2, wins: 10 },
  { n: 3, wins: 50 },
  { n: 4, wins: 150 },
  { n: 5, wins: 400 },
  { n: 6, wins: 900 },
  { n: 7, wins: 2000 },
  { n: 8, wins: 5000 },
];

const DEFAULT_LIVE_NAMES = [
  "Rahim", "Sakib", "Tamim", "Karim", "Jamil", "Nayeem", "Riyad", "Sabbir", "Tanvir", "Hasan",
  "Imran", "Rakib", "Shihab", "Mahin", "Faysal", "Rocky", "Sohan", "Arif", "Niloy", "Pavel",
  "Mehedi", "Jubayer", "Rasel", "Anik", "Shawon", "Tuhin", "Robin", "Sumon", "Mizan", "Polash",
  "Joy", "Akash", "Sajid", "Rifat", "Limon", "Shanto", "Bappy", "Fahim", "Nahid", "Sajib",
  "Tonmoy", "Dipto", "Sourav", "Pritom", "Shuvo", "Ratul", "Jewel", "Munna", "Nabil", "Ovi",
  "Borsha", "Mim", "Tisha", "Nila", "Sumi", "Lamia", "Ria", "Mitu", "Jui", "Tania",
];

const DEFAULT_MODES = ["Classic", "Speed", "Quick", "Time"];
const DEFAULT_STAKES = [10, 20, 50, 100, 200, 500, 1000, 2000];

type LiveBoardCfg = {
  enabled: boolean;
  win_rate_display: number;
  win_chance: number;
  online_min: number;
  online_max: number;
  paid_base: number;
  paid_growth: number;
  games_min: number;
  games_max: number;
  win_multiplier: number;
  row_interval_ms: number;
  names: string[];
  modes: string[];
  stakes: number[];
};

const DEFAULT_LIVE_CFG: LiveBoardCfg = {
  enabled: true,
  win_rate_display: 70,
  win_chance: 70,
  online_min: 1240,
  online_max: 1320,
  paid_base: 1850,
  paid_growth: 0.137,
  games_min: 320,
  games_max: 360,
  win_multiplier: 1.9,
  row_interval_ms: 2200,
  names: DEFAULT_LIVE_NAMES,
  modes: DEFAULT_MODES,
  stakes: DEFAULT_STAKES,
};

type LiveRow = { id: number; name: string; mode: string; amount: number; win: boolean; ago: string };

let rowCounter = 0;
function makeRow(cfg: LiveBoardCfg): LiveRow {
  rowCounter += 1;
  const names = cfg.names.length ? cfg.names : DEFAULT_LIVE_NAMES;
  const modes = cfg.modes.length ? cfg.modes : DEFAULT_MODES;
  const stakes = cfg.stakes.length ? cfg.stakes : DEFAULT_STAKES;
  const name = names[Math.floor(Math.random() * names.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  const mode = modes[Math.floor(Math.random() * modes.length)];
  const stake = stakes[Math.floor(Math.random() * stakes.length)];
  const win = Math.random() < (cfg.win_chance / 100);
  const amount = win ? Math.floor(stake * cfg.win_multiplier) : stake;
  const ago = `${Math.floor(1 + Math.random() * 50)}s`;
  return { id: rowCounter, name: `${name}${suffix}`, mode, amount, win, ago };
}


function HomePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const c = useCurrency();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bal, setBal] = useState<Balance>({ deposit: 0, winnings: 0 });
  const [unread, setUnread] = useState(0);
  const [banners, setBanners] = useState<any[]>([]);
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [notice, setNotice] = useState<{ id: string; title: string; body: string | null } | null>(null);
  const [tourneys, setTourneys] = useState<any[]>([]);
  const [royalEnabled, setRoyalEnabled] = useState(true);
  const [liveCfg, setLiveCfg] = useState<LiveBoardCfg>(DEFAULT_LIVE_CFG);

  useEffect(() => {
    let active = true;
    const load = () => supabase.from("app_settings").select("value").eq("key", "royal_steps").maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const v: any = data?.value;
        if (v && typeof v.enabled === "boolean") setRoyalEnabled(v.enabled);
        else setRoyalEnabled(true);
      });
    load();
    const ch = supabase
      .channel("home_royal_steps_cfg")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.royal_steps" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => supabase.from("app_settings").select("value").eq("key", "live_board").maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const v: any = data?.value || {};
        const parseList = (s: any, fb: string[]) =>
          typeof s === "string" ? s.split(",").map((x) => x.trim()).filter(Boolean) : Array.isArray(s) ? s : fb;
        const parseNums = (s: any, fb: number[]) => {
          const arr = parseList(s, []);
          const nums = arr.map(Number).filter((n) => !isNaN(n) && n > 0);
          return nums.length ? nums : fb;
        };
        setLiveCfg({
          ...DEFAULT_LIVE_CFG,
          ...v,
          names: parseList(v.names, DEFAULT_LIVE_NAMES),
          modes: parseList(v.modes, DEFAULT_MODES),
          stakes: parseNums(v.stakes, DEFAULT_STAKES),
        });
      });
    load();
    const ch = supabase
      .channel("home_live_board_cfg")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.live_board" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    setLiveRows(Array.from({ length: 10 }, () => makeRow(liveCfg)));
    const t = setInterval(() => {
      setLiveRows((prev) => [makeRow(liveCfg), ...prev].slice(0, 12));
    }, Math.max(500, liveCfg.row_interval_ms));
    return () => clearInterval(t);
  }, [liveCfg]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: b }, { count }, { data: bs }, { data: nt }, { data: tn }] = await Promise.all([
        supabase.from("profiles").select("username, game_id, avatar_url, total_wins").eq("id", user.id).maybeSingle(),
        supabase.from("balances").select("deposit_balance, winnings_balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("banners").select("*").eq("is_active", true).order("sort_order").limit(5),
        supabase.from("notifications").select("id, title, body").eq("user_id", user.id).eq("type", "system").eq("is_read", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("tournaments").select("id, name, prize_pool, entry_fee, start_at, max_players, status").in("status", ["upcoming", "live"]).order("start_at").limit(5),
      ]);
      if (p) setProfile(p as Profile);
      if (b) setBal({ deposit: Number(b.deposit_balance) || 0, winnings: Number(b.winnings_balance) || 0 });
      setUnread(count ?? 0);
      setBanners(bs ?? []);
      if (nt) setNotice(nt as any);
      setTourneys(tn ?? []);
    })();
  }, [user]);

  const total = bal.deposit + bal.winnings;

  const dismissNotice = async () => {
    if (!notice) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", notice.id);
    setNotice(null);
  };

  const copyId = async () => {
    if (!profile?.game_id) return;
    await navigator.clipboard.writeText(profile.game_id);
    toast.success(t("copied"));
  };

  return (
    <div className="px-3 pt-3 space-y-3">
      {/* Header — Ludo-Club style profile + level bar */}
      {(() => {
        const wins = profile?.total_wins ?? 0;
        const current = [...LEVEL_TIERS].reverse().find((l) => wins >= l.wins) ?? LEVEL_TIERS[0];
        const next = LEVEL_TIERS.find((l) => l.n === current.n + 1);
        const pct = next ? Math.min(100, ((wins - current.wins) / (next.wins - current.wins)) * 100) : 100;
        return (
          <div className="flex items-center gap-2">
            <Link to="/profile" className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-white to-white/80 border-2 border-white shadow-[0_3px_0_rgba(0,0,0,0.25)] flex items-center justify-center overflow-hidden active:translate-y-0.5 transition">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5 text-primary/70" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-white tracking-tight truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]" style={{ fontFamily: "var(--font-display)" }}>
                {profile?.username || (lang === "bn" ? "প্লেয়ার" : "Player")}
              </h1>
              <Link to="/levels" className="mt-0.5 relative h-3 rounded-full bg-primary/40 border border-white/80 shadow-inner block overflow-visible">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent via-accent/90 to-accent/70"
                  style={{ width: `${pct}%` }}
                />
                <div className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full bg-gradient-to-br from-accent to-accent/80 border-2 border-white shadow-[0_2px_0_rgba(0,0,0,0.3)] flex items-center justify-center">
                  <Star className="h-2.5 w-2.5 text-white fill-white absolute" />
                  <span className="relative text-[9px] font-black text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.5)] mt-0.5">{current.n}</span>
                </div>
              </Link>
              <button onClick={copyId} className="mt-1 inline-flex items-center gap-1 text-[9px] text-white/80">
                ID: {profile?.game_id ?? "—"} <Copy className="h-2 w-2" />
              </button>
            </div>
            <Link to="/play-friend" className="shrink-0 h-9 w-9 rounded-xl bg-gradient-to-b from-accent to-accent/70 border-2 border-white/60 shadow-[0_3px_0_rgba(0,0,0,0.3),0_0_10px_rgba(255,180,0,0.5)] flex items-center justify-center active:translate-y-0.5 transition" aria-label="Play with friend">
              <Plus className="h-5 w-5 text-white" strokeWidth={3} />
            </Link>
            <Link to="/notifications" className="relative shrink-0 h-9 w-9 rounded-xl bg-white/15 border-2 border-white/40 backdrop-blur flex items-center justify-center active:translate-y-0.5 transition">
              <Bell className="h-4 w-4 text-white" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-black border border-background flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        );
      })()}

      {/* Admin notice banner */}
      {notice && (
        <div className="rounded-2xl border border-gold/60 bg-gradient-to-r from-accent/30 via-card/80 to-primary/20 p-3 flex items-start gap-2 shadow-glow animate-fade-in">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
            <Megaphone className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold text-gold truncate">{notice.title}</div>
            {notice.body && <div className="text-[11px] text-foreground/80 line-clamp-2 mt-0.5">{notice.body}</div>}
          </div>
          <button onClick={dismissNotice} className="h-6 w-6 rounded-full bg-secondary/60 flex items-center justify-center shrink-0">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Wallet card — compact neon 3D */}
      <div className="relative rounded-2xl p-2.5 text-white overflow-hidden border-2 border-primary/70 bg-gradient-to-br from-primary/60 via-primary/40 to-primary/20 shadow-[0_0_20px_oklch(0.58_0.22_258/0.5),inset_0_1px_0_oklch(1_0_0/0.25)]">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/40 blur-3xl" />
        <div className="flex items-center justify-between gap-2 relative">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-semibold opacity-90"><Wallet className="h-3 w-3" />{t("total_balance")}</div>
            <div className="text-xl font-black tracking-tight leading-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]" style={{ fontFamily: "var(--font-display)" }}>
              {c} {total.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] opacity-90">
              <span>D:<b>{c}{bal.deposit.toFixed(0)}</b></span>
              <span className="opacity-60">|</span>
              <span>W:<b>{c}{bal.winnings.toFixed(0)}</b></span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Link
              to="/add-cash"
              className="h-8 px-2.5 rounded-full bg-gradient-to-b from-primary/80 to-primary/50 border border-primary-foreground/30 shadow-[0_0_10px_oklch(0.58_0.22_258/0.6),inset_0_1px_0_oklch(1_0_0/0.3)] flex items-center justify-center gap-1 text-[10px] font-bold active:translate-y-0.5 transition"
            >
              <Plus className="h-3 w-3" />{t("add_cash")}
            </Link>
            <Link
              to="/withdraw"
              className="h-8 px-2.5 rounded-full bg-gradient-to-b from-primary/80 to-primary/50 border border-primary-foreground/30 shadow-[0_0_10px_oklch(0.58_0.22_258/0.6),inset_0_1px_0_oklch(1_0_0/0.3)] flex items-center justify-center gap-1 text-[10px] font-bold active:translate-y-0.5 transition"
            >
              <ArrowDownToLine className="h-3 w-3" />{t("withdraw")}
            </Link>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-1.5">
        <QuickAction icon={<Gamepad2 className="h-5 w-5" strokeWidth={2.5} />} label={t("games")} to="/games" />
        <QuickAction icon={<Trophy className="h-5 w-5" strokeWidth={2.5} />} label={lang === "bn" ? "টুর্নামেন্ট" : "Tourneys"} to="/tournaments" />
        <QuickAction icon={<Sparkles className="h-5 w-5" strokeWidth={2.5} />} label={lang === "bn" ? "রিওয়ার্ড" : "Rewards"} to="/rewards" />
        <QuickAction icon={<Gift className="h-5 w-5" strokeWidth={2.5} />} label={t("refer_earn")} to="/referral" />
      </div>

      {/* Banners */}
      {banners.length > 0 && (
        <div className="flex gap-3 overflow-x-auto -mx-3 px-3 snap-x snap-mandatory scrollbar-none">
          {banners.map((b) => {
            const url = b.link_url || "#";
            const isInternal = url.startsWith("/") && !url.startsWith("//");
            const inner = (
              <>
                {b.image_url ? (
                  <img src={b.image_url} alt={b.title} className="w-full h-28 object-cover" />
                ) : (
                  <div className="h-28 bg-gradient-to-br from-primary/30 to-accent/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-3">
                  <div className="font-bold text-white text-sm">{b.title}</div>
                  {b.subtitle && <div className="text-[11px] text-white/80 truncate">{b.subtitle}</div>}
                </div>
              </>
            );
            const cls = "snap-start shrink-0 w-[88%] rounded-2xl overflow-hidden border border-border bg-card relative";
            return isInternal ? (
              <Link key={b.id} to={url as any} className={cls}>{inner}</Link>
            ) : (
              <a key={b.id} href={url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            );
          })}
        </div>
      )}

      {/* Game hub — compact */}
      <div>
        <h2 className="text-xs font-extrabold mb-1.5 text-gold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {lang === "bn" ? "গেম খেলুন" : "Play Games"}
        </h2>
        <div className="flex gap-2 items-stretch">
          <Link
            to="/games"
            className="flex-1 block relative h-24 rounded-2xl overflow-hidden active:scale-[0.98] transition border-2 border-yellow-400/70 shadow-[0_4px_0_rgba(0,0,0,0.4),0_0_22px_rgba(0,80,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
            style={{ background: "radial-gradient(ellipse at center, oklch(0.32 0.14 258) 0%, oklch(0.14 0.08 258) 100%)" }}
          >
            <span className="absolute -left-4 -top-6 h-24 w-24 rounded-full bg-blue-500/40 blur-2xl" />
            <span className="absolute -right-4 -bottom-6 h-24 w-24 rounded-full bg-fuchsia-500/30 blur-2xl" />

            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-700 ring-2 ring-yellow-300/70 flex items-center justify-center"
              style={{ boxShadow: "0 6px 0 rgba(0,0,0,0.4), 0 0 20px rgba(56,189,248,0.6), inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -8px 14px rgba(0,0,0,0.35)" }}
            >
              <span className="absolute top-[12%] left-[20%] h-3 w-5 rounded-full bg-white/40 blur-[2px]" />
              <Dices className="h-9 w-9 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            </div>

            <div className="absolute inset-y-0 left-24 right-3 flex flex-col items-center justify-center">
              <div
                className="text-[clamp(14px,4.5vw,20px)] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-600 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]"
                style={{ fontFamily: "var(--font-display)", WebkitTextStroke: "0.5px rgba(120,80,0,0.5)" }}
              >
                {lang === "bn" ? "লুডু গেম" : "Ludo Game"}
              </div>
              <div className="text-[clamp(7px,2.2vw,10px)] font-semibold text-white/85 tracking-wide mt-0.5">
                {lang === "bn" ? "ক্লাসিক • স্পিড • কুইক" : "Classic • Speed • Quick"}
              </div>
            </div>

            <span className="absolute top-1.5 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white font-black border border-yellow-300 shadow-[0_0_8px_rgba(255,80,80,0.6)]">HOT</span>
          </Link>

          {royalEnabled && (
            <Link
              to="/royal-steps"
              className="shrink-0 w-20 h-24 rounded-2xl border-2 border-yellow-400/70 flex flex-col items-center justify-center gap-1 active:translate-y-0.5 transition shadow-[0_4px_0_rgba(0,0,0,0.4),0_0_18px_rgba(255,180,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] relative overflow-hidden"
              style={{ background: "radial-gradient(ellipse at center, oklch(0.32 0.14 258) 0%, oklch(0.14 0.08 258) 100%)" }}
              aria-label="Royal Steps"
            >
              <div
                className="relative h-9 w-9 rounded-full bg-gradient-to-br from-amber-300 to-orange-600 flex items-center justify-center"
                style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35), 0 0 14px rgba(251,191,36,0.55), inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -5px 10px rgba(0,0,0,0.3)" }}
              >
                <span className="absolute top-[10%] left-[18%] h-1.5 w-3 rounded-full bg-white/45 blur-[1.5px]" />
                <Trophy className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[8px] font-black text-yellow-200/95 tracking-wide leading-tight text-center px-1">
                {lang === "bn" ? "রয়্যাল স্টেপস" : "Royal Steps"}
              </span>
            </Link>
          )}

          <button
            onClick={() => toast.info(lang === "bn" ? "শীঘ্রই আসছে" : "Coming soon")}
            className="shrink-0 w-12 h-24 rounded-2xl border-2 border-yellow-400/60 flex flex-col items-center justify-center gap-1 active:translate-y-0.5 transition shadow-[0_4px_0_rgba(0,0,0,0.4),0_0_18px_rgba(255,180,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]"
            style={{ background: "radial-gradient(ellipse at center, oklch(0.32 0.14 258) 0%, oklch(0.14 0.08 258) 100%)" }}
            aria-label="More games"
          >
            <div
              className="relative h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-600 flex items-center justify-center"
              style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.35), 0 0 12px rgba(251,191,36,0.55), inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -5px 10px rgba(0,0,0,0.3)" }}
            >
              <Plus className="h-4 w-4 text-white" strokeWidth={3} />
            </div>
          </button>

        </div>

      </div>

      {/* Upcoming tournaments */}
      {tourneys.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-extrabold text-gold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {lang === "bn" ? "টুর্নামেন্ট" : "Tournaments"}
            </h2>
            <Link to="/tournaments" className="text-[11px] font-semibold text-primary">{lang === "bn" ? "সব দেখুন" : "View all"} →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto overflow-y-visible -mx-3 px-3 py-2 snap-x snap-mandatory scrollbar-none">
            {tourneys.map((tr) => {
              const live = tr.status === "live";
              return (
                <Link
                  key={tr.id}
                  to="/tournaments/$id"
                  params={{ id: tr.id }}
                  className="snap-start shrink-0 w-[78%] rounded-2xl border border-gold/50 bg-gradient-to-br from-primary/20 via-card/80 to-accent/20 p-3 shadow-glow active:scale-[0.98] transition relative overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/30 blur-2xl" />
                  <div className="flex items-start justify-between relative">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gold">
                          {live ? (lang === "bn" ? "লাইভ" : "LIVE") : (lang === "bn" ? "আসছে" : "UPCOMING")}
                        </span>
                        {live && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
                      </div>
                      <div className="text-sm font-extrabold mt-0.5 truncate">{tr.name}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] relative">
                    <div>
                      <div className="text-muted-foreground text-[9px]">{lang === "bn" ? "প্রাইজ" : "Prize"}</div>
                      <div className="font-extrabold text-success">{c}{Number(tr.prize_pool).toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[9px]">{lang === "bn" ? "এন্ট্রি" : "Entry"}</div>
                      <div className="font-bold">{c}{Number(tr.entry_fee).toFixed(0)}</div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="font-semibold">{tr.max_players}</span>
                    </div>
                  </div>
                  {tr.start_at && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground relative">
                      <Clock className="h-3 w-3" />
                      {new Date(tr.start_at).toLocaleString()}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Live stats board */}
      {liveCfg.enabled && (
      <div className="rounded-2xl border border-gold/40 bg-card/80 backdrop-blur overflow-hidden shadow-glow">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-gradient-to-r from-primary/10 via-accent/10 to-transparent">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-[11px] font-bold tracking-wide text-gold">{lang === "bn" ? "লাইভ উইন বোর্ড" : "LIVE WIN BOARD"}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="font-bold text-success">{liveCfg.win_rate_display}%</span>
            <span>{lang === "bn" ? "উইন রেট" : "win rate"}</span>
          </div>
        </div>
        <LiveStats lang={lang} cfg={liveCfg} />
        <div className="relative h-[220px] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
          <div className="flex flex-col">
            {liveRows.map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 animate-fade-in"
                style={{ opacity: Math.max(0.35, 1 - idx * 0.06) }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle className="h-1.5 w-1.5 fill-success text-success shrink-0" />
                  <span className="text-[11px] font-semibold truncate max-w-[90px]">{r.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground shrink-0">{r.mode}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-muted-foreground">{r.ago}</span>
                  {r.win ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
                      <TrendingUp className="h-3 w-3" />+{c}{r.amount}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive/90">
                      <TrendingDown className="h-3 w-3" />-{c}{r.amount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

    </div>
  );
}

function LiveStats({ lang, cfg }: { lang: string; cfg: LiveBoardCfg }) {
  const c = useCurrency();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(i);
  }, []);
  const onlineSpan = Math.max(1, cfg.online_max - cfg.online_min);
  const gamesSpan = Math.max(1, cfg.games_max - cfg.games_min);
  const players = cfg.online_min + (tick % onlineSpan);
  const paid = cfg.paid_base + tick * cfg.paid_growth;
  const games = cfg.games_min + (tick % gamesSpan);
  return (
    <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] border-b border-border bg-secondary/20">
      <div className="text-center">
        <div className="text-muted-foreground">{lang === "bn" ? "অনলাইন" : "Online"}</div>
        <div className="font-bold text-foreground">{players.toLocaleString()}</div>
      </div>
      <div className="text-center border-x border-border/60">
        <div className="text-muted-foreground">{lang === "bn" ? "আজ পেইড" : "Paid Today"}</div>
        <div className="font-bold text-success">{c}{paid.toFixed(1)}K</div>
      </div>
      <div className="text-center">
        <div className="text-muted-foreground">{lang === "bn" ? "চলমান" : "Live Games"}</div>
        <div className="font-bold text-foreground">{games}</div>
      </div>
    </div>
  );

}

function QuickAction({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border-2 border-primary/60 bg-gradient-to-b from-primary/20 to-primary/5 backdrop-blur-sm shadow-[0_0_12px_oklch(0.58_0.22_258/0.35),inset_0_1px_0_oklch(1_0_0/0.15)] active:translate-y-0.5 transition"
    >
      <div className="text-gold drop-shadow-[0_0_6px_oklch(0.84_0.16_85/0.7)]">{icon}</div>
      <span className="text-[9px] text-center text-white font-bold leading-tight">{label}</span>
    </Link>
  );
}