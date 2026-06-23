import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Award, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/levels")({
  component: LevelsPage,
});

const LEVELS = [
  { n: 1, name: "Rookie",    name_bn: "নবাগত",       wins: 0,    color: "#9ca3af", rooms: "Practice" },
  { n: 2, name: "Bronze",    name_bn: "ব্রোঞ্জ",      wins: 10,   color: "#cd7f32", rooms: "Bronze rooms" },
  { n: 3, name: "Silver",    name_bn: "সিলভার",      wins: 50,   color: "#c0c0c0", rooms: "Silver rooms" },
  { n: 4, name: "Gold",      name_bn: "গোল্ড",        wins: 150,  color: "#fdd835", rooms: "Gold rooms" },
  { n: 5, name: "Platinum",  name_bn: "প্ল্যাটিনাম",  wins: 400,  color: "#5cbdb9", rooms: "Platinum rooms" },
  { n: 6, name: "Diamond",   name_bn: "ডায়মন্ড",      wins: 900,  color: "#4f46e5", rooms: "Diamond rooms" },
  { n: 7, name: "Master",    name_bn: "মাস্টার",      wins: 2000, color: "#e94560", rooms: "Master rooms" },
  { n: 8, name: "Grandmaster", name_bn: "গ্র্যান্ডমাস্টার", wins: 5000, color: "#a78bfa", rooms: "All rooms + tournaments" },
];

function LevelsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [wins, setWins] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("total_wins").eq("id", user.id).single()
      .then(({ data }) => setWins(data?.total_wins ?? 0));
  }, [user?.id]);

  const current = [...LEVELS].reverse().find((l) => wins >= l.wins) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.n === current.n + 1);
  const progress = next ? Math.min(100, ((wins - current.wins) / (next.wins - current.wins)) * 100) : 100;

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/profile"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Award className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "লেভেল ও অর্জন" : "Levels & Achievements"}</h1>
      </div>

      <Card className="p-5 text-center bg-gradient-to-br from-primary/15 to-transparent border-primary/30">
        <div
          className="mx-auto w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-lg mb-2"
          style={{ background: current.color }}
        >
          {current.n}
        </div>
        <div className="text-lg font-bold">
          {lang === "bn" ? current.name_bn : current.name}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {lang === "bn" ? "মোট জয়" : "Total wins"}: <span className="font-semibold text-foreground">{wins}</span>
        </div>
        {next ? (
          <div className="mt-4 space-y-1.5">
            <Progress value={progress} className="h-2" />
            <div className="text-[11px] text-muted-foreground">
              {next.wins - wins} {lang === "bn" ? `টি জয় বাকি — Level ${next.n}` : `wins to Level ${next.n} (${next.name})`}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-primary font-semibold">
            {lang === "bn" ? "🏆 সর্বোচ্চ লেভেলে পৌঁছেছেন!" : "🏆 You reached the top level!"}
          </div>
        )}
      </Card>

      <div className="space-y-2">
        {LEVELS.map((l) => {
          const unlocked = wins >= l.wins;
          const isCurrent = l.n === current.n;
          return (
            <Card
              key={l.n}
              className={`p-3 flex items-center gap-3 ${isCurrent ? "border-primary/60 bg-primary/5" : ""}`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black shrink-0"
                style={{ background: unlocked ? l.color : "#374151" }}
              >
                {unlocked ? l.n : <Lock className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {lang === "bn" ? l.name_bn : l.name}
                  {unlocked && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "bn" ? `${l.wins} জয় প্রয়োজন` : `Requires ${l.wins} wins`} · {l.rooms}
                </div>
              </div>
              {isCurrent && (
                <div className="text-[10px] uppercase tracking-wider text-primary font-bold">
                  {lang === "bn" ? "এখন" : "Now"}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}