import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrencyInfo } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fx-casino")({
  component: FxCasinoPage,
});

type FxCfg = {
  enabled: boolean;
  min_bet: number;
  max_bet: number;
  win_chance: number;
  payout_multiplier: number;
  preset_stakes: number[];
};

const DEFAULT_CFG: FxCfg = {
  enabled: true,
  min_bet: 10,
  max_bet: 1000,
  win_chance: 0.45,
  payout_multiplier: 1.9,
  preset_stakes: [10, 50, 100, 250, 500, 1000],
};

function FxCasinoPage() {
  const { user } = useAuth();
  const { symbol: currencySymbol } = useCurrencyInfo();
  const nav = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [cfg, setCfg] = useState<FxCfg>(DEFAULT_CFG);
  const [enabled, setEnabled] = useState(true);

  // Load config
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "fx_casino").maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = { ...DEFAULT_CFG, ...(data.value as Partial<FxCfg>) };
          setCfg(v);
          setEnabled(v.enabled !== false);
        }
      });
    const ch = supabase
      .channel("fx_cfg")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.fx_casino" },
        (p: any) => {
          const v = { ...DEFAULT_CFG, ...((p.new?.value || {}) as Partial<FxCfg>) };
          setCfg(v);
          setEnabled(v.enabled !== false);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Push balance & config into iframe
  const postBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("balances")
      .select("deposit_balance, winnings_balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const total = (Number(data?.deposit_balance) || 0) + (Number(data?.winnings_balance) || 0);
    iframeRef.current?.contentWindow?.postMessage({ type: "fx:setBalance", amount: total }, "*");
  };

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("fx_bal_" + user.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.id}` },
        postBalance)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Bridge messages from iframe
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || typeof d !== "object") return;

      if (d.type === "fx:placeBet") {
        const stake = Number(d.stake);
        const direction = d.direction === "SELL" ? "SELL" : "BUY";
        const { data, error } = await supabase.rpc("fx_play_bet", {
          _stake: stake, _direction: direction,
        });
        const res: any = data;
        if (error || !res?.ok) {
          iframeRef.current?.contentWindow?.postMessage({
            type: "fx:betDenied",
            error: res?.error || error?.message || "Bet rejected",
          }, "*");
          if (res?.error === "insufficient_balance") toast.error("Insufficient balance");
          else if (res?.error === "disabled") toast.error("FX Casino is disabled");
          else if (res?.error === "bet_out_of_range") toast.error(`Bet must be ${res?.min}-${res?.max}`);
          return;
        }
        iframeRef.current?.contentWindow?.postMessage({
          type: "fx:betResult",
          ok: true,
          won: res.won,
          stake: res.stake,
          payout: res.payout,
          profit: res.profit,
        }, "*");
        postBalance();
      } else if (d.type === "fx:tradeSettled") {
        postBalance();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Send initial config + balance when iframe loads
  const onIframeLoad = () => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "fx:setConfig",
      min_bet: cfg.min_bet,
      max_bet: cfg.max_bet,
      preset_stakes: cfg.preset_stakes,
      currency: currencySymbol,
    }, "*");
    postBalance();
  };

  // Re-push config when it changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "fx:setConfig",
      min_bet: cfg.min_bet,
      max_bet: cfg.max_bet,
      preset_stakes: cfg.preset_stakes,
      currency: currencySymbol,
    }, "*");
  }, [cfg, currencySymbol]);

  if (!enabled) {
    return (
      <div className="px-4 pt-6 space-y-4 text-center">
        <button onClick={() => nav({ to: "/games" })} className="inline-flex items-center gap-1 text-white/70">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-2xl border border-gold/40 bg-card/50 p-6">
          <div className="text-lg font-bold text-gold">FX Casino is currently disabled</div>
          <div className="text-white/60 text-sm mt-1">Please check back later.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-card/80 border-b border-gold/30">
        <button onClick={() => nav({ to: "/games" })} className="inline-flex items-center gap-1 text-white text-sm">
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>
        <div className="text-xs font-black text-gold tracking-wider">FX CASINO</div>
        <div className="w-12" />
      </div>
      <iframe
        ref={iframeRef}
        src="/games/fx-casino/index.html"
        onLoad={onIframeLoad}
        className="flex-1 w-full border-0 bg-black"
        title="FX Casino"
        allow="autoplay"
      />
    </div>
  );
}
