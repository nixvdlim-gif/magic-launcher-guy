import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Coins, Trophy, Users, Plus, Zap } from "lucide-react";
import { BalanceBar } from "@/components/BalanceBar";

export const Route = createFileRoute("/_authenticated/play/$mode")({
  component: BattleTablePage,
});

const DEFAULT_BETS: Record<string, number[]> = {
  classic: [10, 20, 50, 100, 250, 500],
  speed: [20, 50, 100, 200],
  quick: [50, 100, 200],
  time: [100, 200, 500],
};

const MODE_CONFIG: Record<string, { name: { bn: string; en: string }; players: 2 | 4 }> = {
  classic: { name: { bn: "ক্লাসিক লুডু", en: "Classic Ludo" }, players: 4 },
  speed: { name: { bn: "স্পিড লুডু", en: "Speed Ludo" }, players: 2 },
  quick: { name: { bn: "কুইক লুডু", en: "Quick Ludo" }, players: 2 },
  time: { name: { bn: "টাইম লুডু", en: "Time Ludo" }, players: 2 },
};

function BattleTablePage() {
  const { mode } = useParams({ from: "/_authenticated/play/$mode" });
  const { lang } = useI18n();
  const c = useCurrency();
  const nav = useNavigate();
  const cfg = MODE_CONFIG[mode] ?? MODE_CONFIG.classic;
  const [entries, setEntries] = useState<number[]>(DEFAULT_BETS[mode] ?? DEFAULT_BETS.classic);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "bet_amounts").maybeSingle();
      const all = { ...DEFAULT_BETS, ...((data?.value as any) ?? {}) };
      const list = (all[mode] as number[]) ?? DEFAULT_BETS[mode] ?? DEFAULT_BETS.classic;
      if (Array.isArray(list) && list.length) setEntries(list);
    })();
  }, [mode]);

  // Generate mock rooms (until socket server is wired up)
  useEffect(() => {
    const seed = entries.flatMap((entry) =>
      Array.from({ length: 2 }).map((_, i) => ({
        id: `${mode}-${entry}-${i}`,
        entry,
        prize: Math.floor(entry * cfg.players * 0.9),
        joined: Math.floor(Math.random() * cfg.players),
        max: cfg.players,
      })),
    );
    setRooms(seed);
  }, [mode, entries]);

  const join = async (room: any) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: bal } = await supabase
      .from("balances")
      .select("deposit_balance, winnings_balance")
      .eq("user_id", u.user.id)
      .maybeSingle();
    const total = Number(bal?.deposit_balance ?? 0) + Number(bal?.winnings_balance ?? 0);
    if (total < room.entry) {
      const { toast } = await import("sonner");
      toast.error(lang === "bn" ? "ব্যালেন্স কম — ডিপোজিট করুন" : "Insufficient balance — please deposit");
      nav({ to: "/add-cash" });
      return;
    }
    nav({ to: "/board/$roomId", params: { roomId: room.id }, search: { entry: room.entry, prize: room.prize, max: room.max } as any });
  };

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/games" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{(cfg.name as any)[lang] ?? cfg.name.en}</h1>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> {cfg.players} {lang === "bn" ? "জন প্লেয়ার" : "players"}
          </div>
        </div>
      </div>

      <Card className="p-3 bg-gradient-to-br from-primary/15 to-accent/10 border-primary/30">
        <div className="flex items-center gap-2 text-xs">
          <Zap className="h-4 w-4 text-accent" />
          {lang === "bn" ? "একটি রুম বেছে নিন এবং খেলা শুরু করুন!" : "Pick a room and start playing!"}
      </div>

      <BalanceBar />
      </Card>

      <div className="space-y-2">
        {rooms.map((r) => {
          const full = r.joined >= r.max;
          return (
            <Card key={r.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex flex-col items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold">{c}{r.entry}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3 w-3 text-yellow-500" />
                    <span className="font-bold text-primary">{c}{r.prize}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {Array.from({ length: r.max }).map((_, i) => (
                      <span key={i} className={i < r.joined ? "text-primary" : ""}>●</span>
                    ))}{" "}
                    {r.joined}/{r.max}
                  </div>
                </div>
              </div>
              <Button size="sm" disabled={full} onClick={() => join(r)} className="min-w-[72px]">
                {full ? (lang === "bn" ? "পূর্ণ" : "Full") : (lang === "bn" ? "যোগ" : "Join")}
              </Button>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" className="w-full" onClick={() => join({ id: `${mode}-new-${Date.now()}`, entry: entries[0], prize: entries[0] * cfg.players, max: cfg.players, joined: 1 })}>
        <Plus className="h-4 w-4 mr-2" /> {lang === "bn" ? "নতুন রুম" : "Create Room"}
      </Button>

      <div className="text-center text-[10px] text-muted-foreground py-2">
        {lang === "bn" ? "* মাল্টিপ্লেয়ার শীঘ্রই আসছে — এটা প্রিভিউ মোড।" : "* Multiplayer coming soon — preview mode."}
      </div>
    </div>
  );
}
