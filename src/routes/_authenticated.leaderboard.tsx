import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, game_id, total_wins, total_games, level")
      .order("total_wins", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="px-5 pt-8 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("leaderboard")}</h1>
      </div>

      {rows.length === 0 && <p className="text-muted-foreground text-center py-12">—</p>}

      <div className="space-y-2">
        {rows.map((p, i) => (
          <Card key={p.id} className="p-3 flex items-center gap-3">
            <div className="w-7 text-center">
              {i < 3 ? <Medal className={`h-5 w-5 mx-auto ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : "text-amber-700"}`} /> : <span className="text-sm text-muted-foreground">{i + 1}</span>}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{p.username}</div>
              <div className="text-xs text-muted-foreground font-mono">#{p.game_id}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary">{p.total_wins} {t("wins")}</div>
              <div className="text-[10px] text-muted-foreground">L{p.level} · {p.total_games} {t("total_games")}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
