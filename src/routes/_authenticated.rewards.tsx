import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Gift, Sparkles, Ticket, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rewards")({
  component: RewardsPage,
});

const REWARDS = [5, 10, 15, 20, 30, 50, 100];

function RewardsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [streak, setStreak] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [busy, setBusy] = useState<"daily" | "spin" | "coupon" | null>(null);
  const [code, setCode] = useState("");
  const [lastSpin, setLastSpin] = useState<string | null>(null);
  const [spinUsed, setSpinUsed] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: bonuses }, { data: spins }] = await Promise.all([
      supabase.from("daily_bonuses").select("claimed_on, day_streak").eq("user_id", user.id).order("claimed_on", { ascending: false }).limit(1),
      supabase.from("spin_history").select("created_at, reward_label").eq("user_id", user.id).gte("created_at", today).order("created_at", { ascending: false }).limit(1),
    ]);
    const last = bonuses?.[0];
    setStreak(last?.day_streak ?? 0);
    setClaimedToday(last?.claimed_on === today);
    setSpinUsed((spins?.length ?? 0) > 0);
    setLastSpin(spins?.[0]?.reward_label ?? null);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const claimDaily = async () => {
    setBusy("daily");
    const { data, error } = await supabase.rpc("claim_daily_bonus");
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`+${c}${(data as any).amount}`);
    refresh();
  };

  const spin = async () => {
    setBusy("spin");
    const { data, error } = await supabase.rpc("spin_wheel");
    setBusy(null);
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(r.amount > 0 ? `🎉 ${r.label}` : "Try again tomorrow");
    refresh();
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy("coupon");
    const { data, error } = await supabase.rpc("redeem_coupon", { _code: code.trim().toUpperCase() });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`+${c}${(data as any).amount}`);
    setCode("");
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/home"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "রিওয়ার্ড" : "Rewards"}</h1>
      </div>

      {/* Daily bonus */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="font-bold flex-1">{lang === "bn" ? "ডেইলি বোনাস" : "Daily Bonus"}</div>
          <Badge variant="outline">Day {Math.max(streak, claimedToday ? streak : streak + 1)}/7</Badge>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {REWARDS.map((amt, i) => {
            const day = i + 1;
            const done = day <= streak && claimedToday ? true : day < streak;
            const next = !claimedToday && day === streak + 1;
            return (
              <div key={day} className={`text-center rounded-md py-2 text-[10px] ${done ? "bg-primary/20 text-primary" : next ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                <div className="font-bold">{c}{amt}</div>
                <div>D{day}</div>
              </div>
            );
          })}
        </div>
        <Button className="w-full" disabled={claimedToday || busy === "daily"} onClick={claimDaily}>
          {claimedToday
            ? lang === "bn" ? "আজ ক্লেইম হয়েছে" : "Claimed today"
            : busy === "daily" ? "…" : lang === "bn" ? "ক্লেইম করুন" : "Claim"}
        </Button>
      </Card>

      {/* Spin */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <div className="font-bold flex-1">{lang === "bn" ? "স্পিন হুইল" : "Spin Wheel"}</div>
          {lastSpin && <Badge variant="outline" className="text-[10px]">{lang === "bn" ? "শেষ" : "Last"}: {lastSpin}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {lang === "bn" ? "প্রতিদিন ১ বার ফ্রি স্পিন!" : "1 free spin per day."}
        </p>
        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
          {[1, 2, 5, 10, 20, 50, 0, 5].map((v, i) => (
            <div key={i} className="rounded bg-secondary py-2 font-bold">{v === 0 ? "—" : `${c}${v}`}</div>
          ))}
        </div>
        <Button className="w-full" disabled={spinUsed || busy === "spin"} onClick={spin}>
          {spinUsed
            ? lang === "bn" ? "আজ ব্যবহার হয়েছে" : "Used today"
            : busy === "spin" ? "Spinning…" : lang === "bn" ? "স্পিন!" : "Spin!"}
        </Button>
      </Card>

      {/* Coupon */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-accent" />
          <div className="font-bold">{lang === "bn" ? "কুপন কোড" : "Coupon Code"}</div>
        </div>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LUDO100" className="uppercase" />
          <Button disabled={busy === "coupon" || !code.trim()} onClick={redeem}>
            {busy === "coupon" ? "…" : lang === "bn" ? "রিডিম" : "Redeem"}
          </Button>
        </div>
      </Card>
    </div>
  );
}