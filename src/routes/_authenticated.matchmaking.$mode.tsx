import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Coins, Users, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/matchmaking/$mode")({
  component: MatchmakingPage,
});

const MODE_CFG: Record<string, { name: { bn: string; en: string }; entries: number[]; players: 2 | 4 }> = {
  classic: { name: { bn: "ক্লাসিক লুডু", en: "Classic Ludo" }, entries: [10, 20, 50, 100, 250, 500], players: 4 },
  speed:   { name: { bn: "স্পিড লুডু",   en: "Speed Ludo"   }, entries: [20, 50, 100, 200],          players: 2 },
  quick:   { name: { bn: "কুইক লুডু",   en: "Quick Ludo"   }, entries: [50, 100, 200],              players: 2 },
  time:    { name: { bn: "টাইম লুডু",   en: "Time Ludo"    }, entries: [100, 200, 500],             players: 2 },
};

type ModeCfg = { enabled: boolean; p2: boolean; p4: boolean };

function MatchmakingPage() {
  const { mode } = useParams({ from: "/_authenticated/matchmaking/$mode" });
  const { lang } = useI18n();
  const cur = useCurrency();
  const nav = useNavigate();
  const cfg = MODE_CFG[mode] ?? MODE_CFG.classic;

  const [entry, setEntry] = useState(cfg.entries[0]);
  const [players, setPlayers] = useState<2 | 4>(2);
  const [adminCfg, setAdminCfg] = useState<ModeCfg>({ enabled: true, p2: true, p4: true });
  const [searching, setSearching] = useState(false);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from("app_settings").select("value").eq("key", "game_modes").maybeSingle()
      .then(({ data }) => {
        const all = (data?.value ?? {}) as Record<string, ModeCfg>;
        const m = all[mode] ?? { enabled: true, p2: true, p4: true };
        setAdminCfg(m);
        // pick a default players value that's enabled
        if (m.p2) setPlayers(2);
        else if (m.p4) setPlayers(4);
      });
  }, [mode]);

  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
      // best-effort cancel on unmount
      supabase.rpc("leave_matchmaking" as any).then(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToRoom = (roomId: string) => {
    cleanup();
    nav({ to: "/room/$roomId", params: { roomId } });
  };

  const startSearch = async () => {
    if (!userId) return;
    if (!adminCfg.enabled) {
      toast.error(lang === "bn" ? "এই মোড বন্ধ আছে" : "Mode disabled");
      return;
    }
    setSearching(true);
    setSeconds(0);
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    const waitMs = 2500 + Math.floor(Math.random() * 2500);
    window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("create_match_with_bots" as any, {
          _mode: mode,
          _entry_fee: entry,
          _players: players,
        });
        if (error) throw error;
        const res = data as { ok: boolean; room_id?: string; error?: string };
        if (!res?.ok || !res.room_id) {
          toast.error(
            res?.error === "insufficient_balance"
              ? (lang === "bn" ? "ব্যালেন্স কম" : "Insufficient balance")
              : (res?.error ?? "Failed"),
          );
          setSearching(false);
          cleanup();
          return;
        }
        toast.success(lang === "bn" ? "ম্যাচ পাওয়া গেছে!" : "Match found!");
        goToRoom(res.room_id);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to start match");
        setSearching(false);
        cleanup();
      }
    }, waitMs);
  };

  const cancel = async () => {
    cleanup();
    setSearching(false);
    setQueueId(null);
    setSeconds(0);
    await supabase.rpc("leave_matchmaking" as any);
    toast(lang === "bn" ? "অনুসন্ধান বাতিল" : "Search cancelled");
  };

  const prize = Math.floor(entry * players * 0.9);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/games" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{(cfg.name as any)[lang] ?? cfg.name.en}</h1>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> {players} {lang === "bn" ? "জন প্লেয়ার" : "players"} · {lang === "bn" ? "অটো ম্যাচ" : "Auto match"}
          </div>
        </div>
      </div>

      {!searching ? (
        <>
          {!adminCfg.enabled && (
            <Card className="p-3 border-destructive/40 bg-destructive/10 text-xs text-center">
              {lang === "bn" ? "এই মোড এখন বন্ধ আছে" : "This mode is currently disabled"}
            </Card>
          )}
          <Card className="p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground">
              {lang === "bn" ? "প্লেয়ার সংখ্যা" : "Players"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => adminCfg.p2 && setPlayers(2)}
                disabled={!adminCfg.p2}
                className={`p-3 rounded-lg border flex items-center justify-center gap-1 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${players === 2 ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                <Users className="h-4 w-4" /> 2 {lang === "bn" ? "জন" : "Players"}
              </button>
              <button
                onClick={() => adminCfg.p4 && setPlayers(4)}
                disabled={!adminCfg.p4}
                className={`p-3 rounded-lg border flex items-center justify-center gap-1 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${players === 4 ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                <Users className="h-4 w-4" /> 4 {lang === "bn" ? "জন" : "Players"}
              </button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground">
              {lang === "bn" ? "এন্ট্রি ফি বাছাই করুন" : "Choose entry fee"}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {cfg.entries.map((e) => (
                <button
                  key={e}
                  onClick={() => setEntry(e)}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition ${entry === e ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  <Coins className="h-3 w-3" /> {cur}{e}
                </button>
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground pt-1">
              {lang === "bn" ? "জিতলে পাবেন" : "Winner gets"}{" "}
              <span className="text-primary font-bold">{cur}{prize}</span>
            </div>
          </Card>

          <Button className="w-full h-12 text-base" onClick={startSearch} disabled={!userId || !adminCfg.enabled || (!adminCfg.p2 && !adminCfg.p4)}>
            {lang === "bn" ? "প্রতিপক্ষ খুঁজুন" : "Find Opponent"}
          </Button>

          <div className="text-[11px] text-center text-muted-foreground">
            {lang === "bn"
              ? "একই এন্ট্রি ফি-র অন্য প্লেয়ারের সাথে মিলে যাবেন"
              : "You'll be paired with another player at the same entry fee"}
          </div>
        </>
      ) : (
        <Card className="p-6 bg-gradient-to-br from-primary/15 to-accent/10 border-primary/30 space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-primary opacity-0" />
            </div>
            <div className="text-lg font-bold">
              {lang === "bn" ? "প্রতিপক্ষ খোঁজা হচ্ছে..." : "Searching opponent..."}
            </div>
            <div className="font-mono text-2xl text-primary">{mm}:{ss}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-background/40 p-2 flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <div>
                <div className="text-muted-foreground">{lang === "bn" ? "এন্ট্রি" : "Entry"}</div>
                <div className="font-bold">{cur}{entry}</div>
              </div>
            </div>
            <div className="rounded-lg bg-background/40 p-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-muted-foreground">{lang === "bn" ? "প্রাইজ" : "Prize"}</div>
                <div className="font-bold text-primary">{cur}{prize}</div>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={cancel}>
            {lang === "bn" ? "বাতিল করুন" : "Cancel"}
          </Button>
        </Card>
      )}
    </div>
  );
}