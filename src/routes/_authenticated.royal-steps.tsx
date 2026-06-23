import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { ArrowLeft, Crown, Trophy, Wallet, Coins, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/royal-steps")({
  component: RoyalStepsPage,
});

type Round = {
  id: string;
  bet: number;
  multipliers: number[];
  max_steps: number;
};

function RoyalStepsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [bal, setBal] = useState(0);
  const [bet, setBet] = useState(10);
  const [round, setRound] = useState<Round | null>(null);
  const [step, setStep] = useState(0);
  const [busted, setBusted] = useState(false);
  const [won, setWon] = useState<{ prize: number; mult: number } | null>(null);
  const [jumping, setJumping] = useState(false);
  const [loading, setLoading] = useState(false);

  // live balance
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("balances")
        .select("deposit_balance, winnings_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setBal((Number(data.deposit_balance) || 0) + (Number(data.winnings_balance) || 0));
    };
    load();
    const ch = supabase
      .channel(`rs_bal_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const n = payload.new;
          if (n) setBal((Number(n.deposit_balance) || 0) + (Number(n.winnings_balance) || 0));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const start = async () => {
    if (loading) return;
    if (bet > bal) {
      toast.error(lang === "bn" ? "ব্যালেন্স কম" : "Insufficient balance");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("royal_steps_start", { _bet: bet });
    setLoading(false);
    const r = data as any;
    if (error || !r?.ok) {
      toast.error(r?.error || error?.message || "Failed");
      return;
    }
    setRound({ id: r.id, bet: r.bet, multipliers: r.multipliers, max_steps: r.max_steps });
    setStep(0);
    setBusted(false);
    setWon(null);
  };

  const climb = async () => {
    if (!round || busted || won || loading) return;
    setLoading(true);
    const { data } = await supabase.rpc("royal_steps_step", { _id: round.id });
    setLoading(false);
    const r = data as any;
    if (!r?.ok) {
      toast.error(r?.error || "Failed");
      return;
    }
    setJumping(true);
    setTimeout(() => setJumping(false), 450);
    setStep(r.step);
    if (r.busted) {
      setBusted(true);
      toast.error(lang === "bn" ? "ফাঁদে পড়েছেন!" : "You hit a trap!");
    }
  };

  const cashout = async () => {
    if (!round || step < 1 || busted || won || loading) return;
    setLoading(true);
    const { data } = await supabase.rpc("royal_steps_cashout", { _id: round.id });
    setLoading(false);
    const r = data as any;
    if (!r?.ok) {
      toast.error(r?.error || "Failed");
      return;
    }
    setWon({ prize: Number(r.prize), mult: Number(r.multiplier) });
    toast.success(`${lang === "bn" ? "জিতেছেন" : "Won"} ${c}${Number(r.prize).toFixed(2)}`);
  };

  const reset = () => {
    setRound(null);
    setStep(0);
    setBusted(false);
    setWon(null);
  };

  const totalSteps = round?.max_steps ?? 10;
  const mults = round?.multipliers ?? Array.from({ length: totalSteps }, (_, i) => Number((1.15 ** (i + 1)).toFixed(2)));
  const nextMult = mults[step] ?? null;
  const currentMult = step > 0 ? mults[step - 1] : null;

  return (
    <div className="h-[100dvh] px-3 pt-2 pb-3 flex flex-col gap-2 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at top, oklch(0.20 0.10 258) 0%, oklch(0.08 0.05 258) 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <Link to="/games" className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-white" />
        </Link>
        <h1 className="text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-600" style={{ fontFamily: "var(--font-display)" }}>
          {lang === "bn" ? "রয়্যাল স্টেপস" : "Royal Steps"}
        </h1>
        <div className="h-9 px-2.5 rounded-xl bg-white/10 border border-yellow-300/40 flex items-center gap-1 text-[11px] font-bold text-yellow-100">
          <Wallet className="h-3.5 w-3.5" />
          {c}{bal.toFixed(2)}
        </div>
      </div>

      {/* Stage */}
      <div className="relative rounded-2xl border-2 border-yellow-400/50 overflow-hidden shadow-[0_0_24px_rgba(0,80,255,0.35)] flex-1 min-h-0" style={{ background: "radial-gradient(ellipse at 30% 20%, oklch(0.28 0.14 258) 0%, oklch(0.10 0.06 258) 60%, oklch(0.06 0.04 258) 100%)" }}>
        <span className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-blue-500/25 blur-3xl" />
        <span className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

        {/* Multiplier readout */}
        <div className="absolute top-3 left-4 z-20">
          <div className="text-[9px] font-bold uppercase tracking-widest text-yellow-200/80">
            {busted ? (lang === "bn" ? "ফাঁদ!" : "Trap!") : won ? (lang === "bn" ? "জিতেছেন" : "Won") : (lang === "bn" ? "মাল্টিপ্লায়ার" : "Multiplier")}
          </div>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-amber-500 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
            {(won?.mult ?? currentMult ?? 1).toFixed(2)}<span className="text-lg text-yellow-300/80">×</span>
          </div>
        </div>

        {/* Isometric Stairs — descending diagonally from upper-right to lower-left */}
        <div className="absolute inset-0">
          {(() => {
            // Map step index → screen position. Path goes from upper-right (i=last) down to lower-left (i=0).
            // But character climbs from low to high multiplier. So reverse: step 0 at bottom-left, last at top-right.
            const posFor = (i: number) => {
              const t = totalSteps <= 1 ? 0 : i / (totalSteps - 1);
              const xPct = 15 + t * 65; // left → right
              const yPct = 78 - t * 58; // bottom → top
              return { xPct, yPct };
            };

            return (
              <>
                {Array.from({ length: totalSteps }).map((_, i) => {
                  const reached = i < step;
                  const isCurrent = i === step - 1;
                  const isNext = i === step && round && !busted && !won;
                  const { xPct, yPct } = posFor(i);

                  // Ludo palette: reached = gold/amber, unreached = deep blue/violet
                  const topGrad = reached
                    ? "linear-gradient(135deg, oklch(0.90 0.16 88), oklch(0.72 0.18 70))"
                    : "linear-gradient(135deg, oklch(0.55 0.16 270), oklch(0.38 0.14 268))";
                  const frontGrad = reached
                    ? "linear-gradient(180deg, oklch(0.55 0.18 60), oklch(0.32 0.14 50))"
                    : "linear-gradient(180deg, oklch(0.28 0.12 268), oklch(0.15 0.08 265))";
                  const sideGrad = reached
                    ? "linear-gradient(180deg, oklch(0.70 0.18 75), oklch(0.42 0.16 55))"
                    : "linear-gradient(180deg, oklch(0.40 0.14 270), oklch(0.22 0.10 265))";
                  const edge = reached ? "oklch(0.95 0.14 92)" : "oklch(0.55 0.18 270 / 0.7)";

                  return (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${xPct}%`,
                        bottom: `${yPct}%`,
                        transform: "translate(-50%, 50%)",
                        zIndex: 5 + i,
                      }}
                    >
                      {/* 3D block built from 3 faces */}
                      <div className="relative" style={{ width: 64, height: 40 }}>
                        {/* Right side face */}
                        <div
                          className="absolute"
                          style={{
                            right: -10,
                            top: 8,
                            width: 14,
                            height: 26,
                            background: sideGrad,
                            transform: "skewY(-30deg)",
                            borderRight: `1px solid ${edge}`,
                            borderBottom: `1px solid ${edge}`,
                            borderRadius: "0 3px 3px 0",
                          }}
                        />
                        {/* Front face */}
                        <div
                          className="absolute left-0 right-0"
                          style={{
                            bottom: -6,
                            height: 18,
                            background: frontGrad,
                            borderRadius: "0 0 4px 4px",
                            border: `1px solid ${edge}`,
                            borderTop: "none",
                          }}
                        />
                        {/* Top face */}
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: topGrad,
                            borderRadius: 6,
                            border: `1.5px solid ${edge}`,
                            boxShadow: reached
                              ? "inset 0 1px 0 oklch(1 0 0 / 0.5), 0 0 14px oklch(0.85 0.20 85 / 0.5)"
                              : "inset 0 1px 0 oklch(1 0 0 / 0.15), 0 0 10px oklch(0.40 0.18 270 / 0.35)",
                          }}
                        >
                          <span className="text-[10px] font-black text-white/95 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
                            ×{mults[i]?.toFixed(2)}
                          </span>
                          {isNext && (
                            <span className="absolute inset-0 rounded-md border-2 border-yellow-200 animate-pulse pointer-events-none" />
                          )}
                          {busted && isCurrent && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg">💥</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Character — hops step-to-step */}
                {(() => {
                  const pos = Math.max(0, Math.min(step, totalSteps - 1));
                  const base = step === 0 ? { xPct: 8, yPct: 82 } : posFor(pos);
                  return (
                    <div
                      className="absolute"
                      style={{
                        left: `${base.xPct}%`,
                        bottom: `${base.yPct}%`,
                        transform: `translate(-50%, ${jumping ? "calc(50% - 28px)" : "calc(50% - 18px)"})`,
                        transition: "left 420ms cubic-bezier(.34,1.56,.64,1), bottom 420ms cubic-bezier(.34,1.56,.64,1), transform 420ms cubic-bezier(.34,1.56,.64,1)",
                        zIndex: 50,
                      }}
                    >
                      <div className="relative flex flex-col items-center" style={{ filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.55))" }}>
                        <Crown className="h-3.5 w-3.5 text-yellow-300 drop-shadow-[0_0_5px_rgba(255,210,80,0.95)] -mb-0.5" fill="currentColor" />
                        {/* Head */}
                        <div className="h-6 w-6 rounded-full border border-yellow-100" style={{ background: "radial-gradient(circle at 30% 30%, oklch(0.92 0.10 80), oklch(0.62 0.18 55))" }} />
                        {/* Body */}
                        <div className="h-7 w-5 rounded-md border border-blue-200/70 -mt-1" style={{ background: "linear-gradient(180deg, oklch(0.65 0.20 260), oklch(0.35 0.18 265))" }} />
                        {/* Shadow under */}
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1.5 w-7 rounded-full bg-black/60 blur-sm" />
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>

        {/* Bet readout */}
        {round && (
          <div className="absolute bottom-2 left-2 text-[10px] text-white/80">
            <Coins className="inline h-3 w-3 text-yellow-300" /> {c}{round.bet}
            <span className="mx-1 opacity-50">•</span>
            {lang === "bn" ? "ধাপ" : "Step"} {step}/{totalSteps}
          </div>
        )}

        {/* Win/Lose overlay */}
        {(won || busted) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-center px-6 py-4 rounded-2xl border-2 border-yellow-300/70 bg-gradient-to-b from-primary/40 to-black/60 shadow-[0_0_30px_rgba(255,200,80,0.4)]">
              {won ? (
                <>
                  <Trophy className="h-10 w-10 mx-auto text-yellow-300" />
                  <div className="mt-1 text-xs text-yellow-100/80">{lang === "bn" ? "জিতেছেন" : "You Won"}</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-amber-500" style={{ fontFamily: "var(--font-display)" }}>
                    {c}{won.prize.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-white/70">×{won.mult.toFixed(2)}</div>
                </>
              ) : (
                <>
                  <Flame className="h-10 w-10 mx-auto text-red-400" />
                  <div className="mt-1 text-xs text-red-200">{lang === "bn" ? "হেরেছেন" : "Busted"}</div>
                </>
              )}
              <button onClick={reset} className="mt-3 h-9 px-5 rounded-full bg-gradient-to-b from-yellow-300 to-amber-600 text-black font-black text-xs border border-yellow-100">
                {lang === "bn" ? "আবার খেলুন" : "Play Again"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {!round ? (
        <div className="space-y-2 shrink-0">
          <div className="rounded-2xl border-2 border-yellow-400/40 bg-white/5 backdrop-blur p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-200/80 mb-1">{lang === "bn" ? "বাজি" : "Bet"}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 0))}
                className="flex-1 h-10 rounded-xl bg-black/40 border border-yellow-300/40 px-3 text-white font-bold"
              />
              <button onClick={() => setBet(10)} className="h-10 px-2 rounded-xl bg-white/10 border border-white/20 text-[10px] font-bold text-white">Min</button>
              <button onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))} className="h-10 px-2 rounded-xl bg-white/10 border border-white/20 text-[10px] font-bold text-white">½</button>
              <button onClick={() => setBet(bet * 2)} className="h-10 px-2 rounded-xl bg-white/10 border border-white/20 text-[10px] font-bold text-white">2×</button>
              <button onClick={() => setBet(Math.max(1, Math.floor(bal)))} className="h-10 px-2 rounded-xl bg-white/10 border border-white/20 text-[10px] font-bold text-white">Max</button>
            </div>
          </div>
          <button
            onClick={start}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-600 text-black font-black border-2 border-yellow-100 shadow-[0_4px_0_rgba(0,0,0,0.4),0_0_18px_rgba(255,200,80,0.5)] active:translate-y-0.5 transition disabled:opacity-50"
          >
            {lang === "bn" ? "শুরু করুন" : "Start Game"}
          </button>
        </div>
      ) : (
        !won && !busted && (
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button
              onClick={cashout}
              disabled={step < 1 || loading}
              className="h-12 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-700 text-white font-black border-2 border-emerald-200 shadow-[0_4px_0_rgba(0,0,0,0.4)] active:translate-y-0.5 transition disabled:opacity-40"
            >
              {lang === "bn" ? "নিন" : "Collect"}
              {step > 0 && <div className="text-[10px] opacity-90">{c}{(round.bet * (currentMult ?? 1)).toFixed(2)}</div>}
            </button>
            <button
              onClick={climb}
              disabled={loading || step >= totalSteps}
              className="h-12 rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-600 text-black font-black border-2 border-yellow-100 shadow-[0_4px_0_rgba(0,0,0,0.4),0_0_18px_rgba(255,200,80,0.5)] active:translate-y-0.5 transition disabled:opacity-40"
            >
              {lang === "bn" ? "উঠুন" : "Climb"}
              {nextMult && <div className="text-[10px] opacity-90">×{nextMult.toFixed(2)}</div>}
            </button>
          </div>
        )
      )}
    </div>
  );
}
