import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { UserPlus, Dices, Zap, Timer, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BalanceBar } from "@/components/BalanceBar";

export const Route = createFileRoute("/_authenticated/games")({
  component: GamesPage,
});


type ModeCfg = { enabled: boolean; p2: boolean; p4: boolean };
type ModesMap = Record<string, ModeCfg>;
const DEFAULT_MODES: ModesMap = {
  classic: { enabled: true, p2: true, p4: true },
  speed:   { enabled: true, p2: true, p4: true },
  quick:   { enabled: true, p2: true, p4: true },
  time:    { enabled: true, p2: true, p4: true },
};

const ICONS: Record<string, { Icon: any; from: string; to: string; ring: string; glow: string }> = {
  classic: { Icon: Dices,  from: "from-sky-400",     to: "to-blue-700",    ring: "ring-sky-300/60",    glow: "rgba(56,189,248,0.55)" },
  speed:   { Icon: Zap,    from: "from-fuchsia-400", to: "to-purple-700",  ring: "ring-fuchsia-300/60", glow: "rgba(232,121,249,0.55)" },
  quick:   { Icon: Timer,  from: "from-emerald-400", to: "to-green-700",   ring: "ring-emerald-300/60", glow: "rgba(52,211,153,0.55)" },
  time:    { Icon: Clock,  from: "from-amber-300",   to: "to-orange-600",  ring: "ring-amber-200/70",   glow: "rgba(251,191,36,0.6)" },
};

const BADGES: Record<string, { label: string; from: string; to: string; border: string } | null> = {
  classic: { label: "HOT", from: "from-red-500", to: "to-red-700", border: "border-yellow-300" },
  time: { label: "PREMIUM", from: "from-amber-500", to: "to-amber-700", border: "border-yellow-200" },
  speed: null,
  quick: null,
};

function GamesPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [modes, setModes] = useState<ModesMap>(DEFAULT_MODES);
  const [fxEnabled, setFxEnabled] = useState(true);
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "game_modes").maybeSingle()
      .then(({ data }) => {
        if (data?.value) setModes({ ...DEFAULT_MODES, ...(data.value as ModesMap) });
      });
    supabase.from("app_settings").select("value").eq("key", "fx_casino").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as any) || {};
        setFxEnabled(v.enabled !== false);
      });
  }, []);
  const games = [
    { mode: "classic", name: t("classic_ludo"), entry: 10, prize: 18, soon: false },
    { mode: "speed", name: t("speed_ludo"), entry: 20, prize: 36, soon: false },
    { mode: "quick", name: t("quick_ludo"), entry: 50, prize: 90, soon: false },
    { mode: "time", name: t("time_ludo"), entry: 100, prize: 180, soon: false },
  ].filter((g) => modes[g.mode]?.enabled !== false);
  return (
    <div className="px-3 pt-4 pb-6 space-y-4">
      <h1 className="text-xl font-black text-gold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t("games")}</h1>
      <BalanceBar />

      {/* Three equal game cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Ludo Game Card */}
        <button
          onClick={() => nav({ to: "/matchmaking/classic" })}
          className="relative text-left rounded-2xl p-2.5 sm:p-3 active:translate-y-0.5 transition overflow-hidden
                     bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.1_258)_0%,oklch(0.12_0.06_258)_100%)]
                     shadow-[0_4px_0_rgba(0,0,0,0.45),0_0_14px_rgba(0,80,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]"
          style={{
            border: "2px solid transparent",
            backgroundImage:
              "radial-gradient(ellipse at top, oklch(0.24 0.1 258) 0%, oklch(0.12 0.06 258) 100%), linear-gradient(135deg, #c9a84c 0%, #8b6d2f 30%, #d4b86a 60%, #6b4c1a 100%)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
          }}
        >
          <div className="flex items-center gap-2">
            {/* Small circular Ludo icon */}
            <div
              className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center"
              style={{
                boxShadow: "0 3px 0 rgba(0,0,0,0.4), 0 0 12px rgba(56,189,248,0.4), inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.3)",
              }}
            >
              <Dices className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="font-black text-[11px] sm:text-sm text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                {lang === "bn" ? "লুডো" : "Ludo"}
              </div>
              <div className="text-[9px] sm:text-[11px] text-white/50 truncate">
                Classic
              </div>
            </div>
          </div>
          <span className="absolute top-1.5 right-1.5 z-10 text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full text-white bg-gradient-to-b from-red-500 to-red-700 border border-yellow-300 shadow-[0_0_6px_rgba(0,0,0,0.5)] tracking-wider">
            HOT
          </span>
        </button>

        {/* FX Casino Card */}
        <button
          onClick={() => nav({ to: "/fx-casino" })}
          className="relative text-left rounded-2xl p-2.5 sm:p-3 active:translate-y-0.5 transition overflow-hidden"
          style={{
            border: "2px solid transparent",
            backgroundImage:
              "radial-gradient(ellipse at top, oklch(0.22 0.1 160) 0%, oklch(0.1 0.06 160) 100%), linear-gradient(135deg, #c9a84c 0%, #8b6d2f 30%, #d4b86a 60%, #6b4c1a 100%)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            boxShadow: "0 4px 0 rgba(0,0,0,0.45), 0 0 14px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-700 flex items-center justify-center"
              style={{
                boxShadow: "0 3px 0 rgba(0,0,0,0.4), 0 0 12px rgba(52,211,153,0.4), inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.3)",
              }}
            >
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="font-black text-[11px] sm:text-sm text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                FX CASINO
              </div>
              <div className="text-[9px] sm:text-[11px] text-white/50 truncate">
                {lang === "bn" ? "ট্রেডিং" : "Trading"}
              </div>
            </div>
          </div>
          <span className="absolute top-1.5 right-1.5 z-10 text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-black tracking-wider shadow-[0_0_6px_rgba(0,0,0,0.4)]">
            NEW
          </span>
        </button>

        {/* Play with Friend Card */}
        <button
          onClick={() => nav({ to: "/play-friend" })}
          className="relative text-left rounded-2xl p-2.5 sm:p-3 active:translate-y-0.5 transition overflow-hidden"
          style={{
            border: "2px solid transparent",
            backgroundImage:
              "radial-gradient(ellipse at top, oklch(0.24 0.1 300) 0%, oklch(0.12 0.06 300) 100%), linear-gradient(135deg, #c9a84c 0%, #8b6d2f 30%, #d4b86a 60%, #6b4c1a 100%)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            boxShadow: "0 4px 0 rgba(0,0,0,0.45), 0 0 14px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-700 flex items-center justify-center"
              style={{
                boxShadow: "0 3px 0 rgba(0,0,0,0.4), 0 0 12px rgba(232,121,249,0.4), inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.3)",
              }}
            >
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="font-black text-[11px] sm:text-sm text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                {lang === "bn" ? "বন্ধু" : "Friend"}
              </div>
              <div className="text-[9px] sm:text-[11px] text-white/50 truncate">
                {lang === "bn" ? "প্রাইভেট" : "Private"}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Ludo mode selector */}
      <div className="pt-1">
        <h2 className="text-sm font-bold text-white/70 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {lang === "bn" ? "লুডো মোড" : "Ludo Modes"}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {games.filter(g => g.mode !== "classic").map((g) => {
            const badge = BADGES[g.mode];
            const cfg = ICONS[g.mode];
            const I = cfg.Icon;
            const tileBg: Record<string, string> = {
              speed:   "from-fuchsia-500 to-purple-700",
              quick:   "from-emerald-500 to-green-700",
              time:    "from-amber-400 to-orange-600",
            };
            return (
              <button
                key={g.mode}
                onClick={() => !g.soon && nav({ to: "/matchmaking/$mode", params: { mode: g.mode } })}
                disabled={g.soon}
                className="relative text-left rounded-xl p-2 disabled:opacity-60 active:translate-y-0.5 transition
                           bg-[radial-gradient(ellipse_at_top,oklch(0.26_0.11_258)_0%,oklch(0.13_0.06_258)_100%)]
                           shadow-[0_3px_0_rgba(0,0,0,0.4),0_0_12px_rgba(0,80,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{
                  border: "1.5px solid transparent",
                  backgroundImage:
                    "radial-gradient(ellipse at top, oklch(0.26 0.11 258) 0%, oklch(0.13 0.06 258) 100%), linear-gradient(135deg, #c9a84c 0%, #8b6d2f 40%, #d4b86a 60%, #6b4c1a 100%)",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`shrink-0 h-7 w-7 rounded-full bg-gradient-to-br ${tileBg[g.mode]} flex items-center justify-center`}
                    style={{
                      boxShadow: "0 2px 0 rgba(0,0,0,0.35), 0 0 10px " + cfg.glow + ", inset 0 1.5px 0 rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.3)",
                    }}
                  >
                    <I className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[11px] text-white/90 truncate">{g.name}</div>
                    <div className="text-[9px] text-white/40">Entry ${g.entry}</div>
                  </div>
                </div>
                {badge && (
                  <span
                    className={`absolute top-1.5 right-1.5 z-10 text-[7px] font-black px-1.5 py-0.5 rounded-full text-white bg-gradient-to-b ${badge.from} ${badge.to} border ${badge.border} shadow-[0_0_6px_rgba(0,0,0,0.5)] tracking-wider`}
                  >
                    {badge.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
