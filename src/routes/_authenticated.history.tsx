import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, History as HistoryIcon, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("game_results")
        .select("*")
        .or(`winner_id.eq.${user.id},player_ids.cs.{${user.id}}`)
        .order("created_at", { ascending: false })
        .limit(50);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="px-4 pt-6 pb-20 space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/profile"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <HistoryIcon className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "গেম ইতিহাস" : "Game History"}</h1>
      </div>

      {loading && <p className="text-center text-sm text-muted-foreground py-6">…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          {lang === "bn" ? "এখনও কোনো গেম খেলেননি" : "No games yet"}
        </p>
      )}

      {rows.map((g) => {
        const won = g.winner_id === user?.id;
        return (
          <Card key={g.id} className="p-3 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${won ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Trophy className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold capitalize">{g.mode}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(g.created_at).toLocaleString()} · {g.player_ids?.length ?? 0}P
              </div>
            </div>
            <div className="text-right">
              <Badge variant={won ? "default" : "outline"} className="text-[10px]">
                {won ? (lang === "bn" ? "জয়" : "Won") : (lang === "bn" ? "হার" : "Lost")}
              </Badge>
              <div className={`text-sm font-bold mt-1 ${won ? "text-primary" : "text-muted-foreground"}`}>
                {won ? "+" : "−"}{c}{won ? Number(g.prize_awarded).toFixed(0) : Number(g.entry_fee).toFixed(0)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}