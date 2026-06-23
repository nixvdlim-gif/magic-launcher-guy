import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users, Calendar, Crown, Award, Share2 } from "lucide-react";
import { toast } from "sonner";
import { TournamentCountdown } from "@/components/TournamentCountdown";

export const Route = createFileRoute("/_authenticated/tournaments/$id")({
  component: TournamentDetail,
});

type Entry = {
  id: string;
  user_id: string;
  placement: number | null;
  prize_won: number;
  profiles?: { username: string; avatar_url: string | null; game_id: string } | null;
};

type Match = {
  id: string;
  round: number;
  match_no: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
};

function TournamentDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [t, setT] = useState<any>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profMap, setProfMap] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: tour } = await supabase.from("tournaments").select("*").eq("id", id).single();
    setT(tour);
    const { data: es } = await supabase
      .from("tournament_entries")
      .select("id, user_id, placement, prize_won")
      .eq("tournament_id", id)
      .order("joined_at");
    const userIds = (es ?? []).map((e: any) => e.user_id);
    let pm: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, game_id")
        .in("id", userIds);
      pm = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    setProfMap(pm);
    setEntries((es ?? []).map((e: any) => ({ ...e, profiles: pm[e.user_id] })));

    const { data: ms } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", id)
      .order("round")
      .order("match_no");
    setMatches((ms as Match[]) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Realtime updates for bracket + entries
  useEffect(() => {
    const ch = supabase
      .channel(`tour:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_entries", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tournament_entries").insert({
      tournament_id: id, user_id: user.id,
    });
    if (error) return toast.error(error.message);
    if (t?.bots_enabled) {
      await supabase.rpc("fill_tournament_with_bots" as any, { _tid: id });
    }
    setBusy(false);
    toast.success(lang === "bn" ? "যোগ দেওয়া হয়েছে" : "Joined");
    load();
  };

  if (!t) {
    return <div className="p-6 text-center text-sm text-muted-foreground">…</div>;
  }

  const isJoined = !!user && entries.some((e) => e.user_id === user.id);
  const full = entries.length >= t.max_players;
  const upcoming = t.status === "upcoming";

  const startTournament = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("start_tournament", { _tid: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "টুর্নামেন্ট শুরু" : "Tournament started");
    // Auto-resolve any bot-vs-bot matches in the bracket
    await supabase.rpc("auto_advance_bot_matches" as any, { _tid: id });
    load();
  };

  const reportWinner = async (matchId: string, winnerId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("report_match_winner", {
      _match_id: matchId,
      _winner_id: winnerId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "জয়ী রিপোর্ট হয়েছে" : "Winner reported");
    // After human reports, auto-resolve any newly-pending bot-vs-bot matches in next round
    await supabase.rpc("auto_advance_bot_matches" as any, { _tid: id });
    load();
  };

  // Real bracket from tournament_matches
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);

  // Prize distribution (50% / 30% / 20% of pool, fallback to single winner)
  const pool = Number(t.prize_pool) || 0;
  const prizeBreakdown = entries.length >= 3
    ? [{ place: 1, amount: Math.floor(pool * 0.5) }, { place: 2, amount: Math.floor(pool * 0.3) }, { place: 3, amount: Math.floor(pool * 0.2) }]
    : [{ place: 1, amount: pool }];

  // Live leaderboard (entries sorted by placement → prize_won)
  const leaderboard = [...entries].sort((a, b) => {
    if (a.placement && b.placement) return a.placement - b.placement;
    if (a.placement) return -1;
    if (b.placement) return 1;
    return Number(b.prize_won) - Number(a.prize_won);
  });

  const shareTournament = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: t.name, text: lang === "bn" ? "এই টুর্নামেন্টে যোগ দিন!" : "Join this tournament!", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(lang === "bn" ? "লিংক কপি হয়েছে" : "Link copied");
      }
    } catch {}
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/tournaments"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold truncate">{t.name}</h1>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={shareTournament}>
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      <Card className="overflow-hidden">
        {t.banner_url && <img src={t.banner_url} alt={t.name} className="w-full h-32 object-cover" />}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold">{t.name}</div>
              {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
            </div>
            <Badge variant={t.status === "live" ? "default" : "outline"} className="uppercase text-[10px]">
              {t.status}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={lang === "bn" ? "প্রাইজ পুল" : "Prize"} value={`${c}${Number(t.prize_pool).toLocaleString()}`} />
            <Stat label={lang === "bn" ? "এন্ট্রি" : "Entry"} value={`${c}${Number(t.entry_fee).toLocaleString()}`} />
            <Stat label={<Users className="h-3 w-3 inline" />} value={`${entries.length}/${t.max_players}`} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(t.start_at).toLocaleString()}
            </div>
            <TournamentCountdown startAt={t.start_at} status={t.status} />
          </div>
          <Button
            className="w-full"
            disabled={!upcoming || full || isJoined || busy}
            onClick={join}
          >
            {isJoined ? (lang === "bn" ? "যোগ দেওয়া হয়েছে" : "Joined")
              : full ? (lang === "bn" ? "পূর্ণ" : "Full")
              : !upcoming ? t.status
              : busy ? "…" : (lang === "bn" ? "যোগ দিন" : "Join Tournament")}
          </Button>
          {upcoming && entries.length >= 2 && (
            <Button variant="outline" className="w-full" onClick={startTournament} disabled={busy}>
              {lang === "bn" ? "টুর্নামেন্ট শুরু (Admin)" : "Start Tournament (Admin)"}
            </Button>
          )}
        </div>
      </Card>

      {/* Prize Distribution */}
      <section>
        <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <Award className="h-4 w-4 text-yellow-500" /> {lang === "bn" ? "প্রাইজ বণ্টন" : "Prize Distribution"}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {prizeBreakdown.map((p) => {
            const winnerEntry = entries.find((e) => e.placement === p.place);
            const colors = ["from-yellow-500/20 to-yellow-700/10 border-yellow-500/40", "from-slate-400/20 to-slate-500/10 border-slate-400/40", "from-orange-500/20 to-orange-700/10 border-orange-500/40"];
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <Card key={p.place} className={`p-2 text-center bg-gradient-to-br border ${colors[p.place - 1]}`}>
                <div className="text-2xl">{medals[p.place - 1]}</div>
                <div className="text-[10px] uppercase text-muted-foreground">#{p.place}</div>
                <div className="font-bold text-sm">{c}{p.amount.toLocaleString()}</div>
                {winnerEntry && (
                  <div className="text-[9px] text-primary truncate mt-0.5">
                    {profMap[winnerEntry.user_id]?.username ?? "?"}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Live Leaderboard (only when matches exist) */}
      {matches.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-yellow-500" /> {lang === "bn" ? "লাইভ লিডারবোর্ড" : "Live Leaderboard"}
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              {lang === "bn" ? "লাইভ" : "LIVE"}
            </span>
          </h2>
          <div className="space-y-1">
            {leaderboard.slice(0, 5).map((e, i) => (
              <Card key={e.id} className={`p-2 flex items-center gap-2 ${e.placement === 1 ? "border-yellow-500/40 bg-yellow-500/5" : ""}`}>
                <div className="w-5 text-xs font-bold text-center">{e.placement || i + 1}</div>
                <div className="text-sm flex-1 truncate">{profMap[e.user_id]?.username ?? "Player"}</div>
                {Number(e.prize_won) > 0 && (
                  <span className="text-xs font-bold text-primary">+{c}{Number(e.prize_won).toLocaleString()}</span>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {lang === "bn" ? "অংশগ্রহণকারী" : "Players"} ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {lang === "bn" ? "এখনো কেউ যোগ দেয়নি" : "No players yet"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e, i) => (
              <Card key={e.id} className="p-2.5 flex items-center gap-3">
                <div className="w-6 text-xs font-bold text-muted-foreground text-center">#{i + 1}</div>
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold overflow-hidden">
                  {e.profiles?.avatar_url
                    ? <img src={e.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (e.profiles?.username?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.profiles?.username ?? "Player"}</div>
                  <div className="text-[10px] text-muted-foreground">#{e.profiles?.game_id}</div>
                </div>
                {e.placement === 1 && <Crown className="h-4 w-4 text-yellow-500" />}
                {e.prize_won > 0 && (
                  <Badge variant="outline" className="text-[10px]">{c}{Number(e.prize_won).toLocaleString()}</Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {matches.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <Trophy className="h-4 w-4" /> {lang === "bn" ? "ব্র্যাকেট" : "Bracket"}
          </h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 min-w-max">
              {rounds.map((rnum) => {
                const rms = matches.filter((m) => m.round === rnum);
                const isFinal = rnum === rounds[rounds.length - 1];
                return (
                  <div key={rnum} className="space-y-2 min-w-[170px]">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider text-center">
                      {isFinal ? (lang === "bn" ? "ফাইনাল" : "Final") : `${lang === "bn" ? "রাউন্ড" : "Round"} ${rnum}`}
                    </div>
                    {rms.map((m) => {
                      const p1 = profMap[m.player1_id || ""];
                      const p2 = profMap[m.player2_id || ""];
                      const canReport =
                        m.status === "pending" &&
                        !!user &&
                        (user.id === m.player1_id || user.id === m.player2_id);
                      return (
                        <Card key={m.id} className="p-1.5 space-y-1">
                          <MatchSlot prof={p1} winner={m.winner_id === m.player1_id} />
                          <div className="border-t border-border/50" />
                          <MatchSlot prof={p2} winner={m.winner_id === m.player2_id} />
                          {canReport && m.player1_id && m.player2_id && (
                            <div className="flex gap-1 pt-1">
                              <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1"
                                onClick={() => reportWinner(m.id, m.player1_id!)} disabled={busy}>
                                {p1?.username || "P1"} won
                              </Button>
                              <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1"
                                onClick={() => reportWinner(m.id, m.player2_id!)} disabled={busy}>
                                {p2?.username || "P2"} won
                              </Button>
                            </div>
                          )}
                          {m.status === "bye" && (
                            <Badge variant="secondary" className="text-[9px] w-full justify-center">BYE</Badge>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: any; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2">
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}

function MatchSlot({ prof, winner }: { prof: any; winner: boolean }) {
  if (!prof) return <div className="text-[11px] text-muted-foreground italic px-1.5 py-1">— TBD —</div>;
  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-1 ${winner ? "bg-primary/10 rounded" : ""}`}>
      <div className="w-5 h-5 rounded-full bg-secondary text-[10px] font-bold flex items-center justify-center overflow-hidden">
        {prof.avatar_url
          ? <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
          : (prof.username?.[0]?.toUpperCase() ?? "?")}
      </div>
      <div className="text-[11px] truncate flex-1">{prof.username ?? "—"}</div>
      {winner && <Crown className="h-3 w-3 text-yellow-500" />}
    </div>
  );
}