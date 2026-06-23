import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TournamentCountdown } from "@/components/TournamentCountdown";

export const Route = createFileRoute("/_authenticated/tournaments")({
  component: TournamentsPage,
});

function TournamentsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: ts } = await supabase
      .from("tournaments")
      .select("*, tournament_entries(count)")
      .order("start_at", { ascending: true });
    setRows(ts ?? []);
    if (user) {
      const { data: my } = await supabase
        .from("tournament_entries")
        .select("tournament_id")
        .eq("user_id", user.id);
      setJoined(new Set((my ?? []).map((r: any) => r.tournament_id)));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const join = async (t: any) => {
    if (!user) return;
    setBusy(t.id);
    const { error } = await supabase.from("tournament_entries").insert({
      tournament_id: t.id,
      user_id: user.id,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "যোগ দেওয়া হয়েছে" : "Joined");
    load();
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/home"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "টুর্নামেন্ট" : "Tournaments"}</h1>
      </div>

      {rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          {lang === "bn" ? "এখন কোনো টুর্নামেন্ট নেই" : "No tournaments yet"}
        </p>
      )}

      {rows.map((t) => {
        const count = (t.tournament_entries?.[0]?.count as number) ?? 0;
        const full = count >= t.max_players;
        const isJoined = joined.has(t.id);
        const upcoming = t.status === "upcoming";
        return (
          <Card key={t.id} className="overflow-hidden">
            <Link to="/tournaments/$id" params={{ id: t.id }} className="block">
              {t.banner_url && <img src={t.banner_url} alt={t.name} className="w-full h-28 object-cover" />}
            </Link>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <Link to="/tournaments/$id" params={{ id: t.id }} className="hover:underline">
                  <div className="font-bold">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                </Link>
                <Badge variant={t.status === "live" ? "default" : "outline"} className="uppercase text-[10px]">
                  {t.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label={lang === "bn" ? "প্রাইজ" : "Prize"} value={`${c}${Number(t.prize_pool).toLocaleString()}`} />
                <Stat label={lang === "bn" ? "এন্ট্রি" : "Entry"} value={`${c}${Number(t.entry_fee).toLocaleString()}`} />
                <Stat label={<Users className="h-3 w-3 inline" />} value={`${count}/${t.max_players}`} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {new Date(t.start_at).toLocaleString()}
                </div>
                <TournamentCountdown startAt={t.start_at} status={t.status} />
              </div>
              <div className="flex gap-2 mt-1">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/tournaments/$id" params={{ id: t.id }}>
                    {lang === "bn" ? "বিস্তারিত" : "Details"}
                  </Link>
                </Button>
                <Button
                  className="flex-1"
                  disabled={!upcoming || full || isJoined || busy === t.id}
                  onClick={() => join(t)}
                >
                  {isJoined
                    ? lang === "bn" ? "যোগ দেওয়া হয়েছে" : "Joined"
                    : full
                      ? lang === "bn" ? "পূর্ণ" : "Full"
                      : !upcoming
                        ? t.status
                        : busy === t.id ? "…" : lang === "bn" ? "যোগ দিন" : "Join"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: any; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2">
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}