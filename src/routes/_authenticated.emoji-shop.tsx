import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, Coins, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/emoji-shop")({
  component: EmojiShopPage,
});

type Category = { id: string; name: string; name_bn: string | null };
type Item = {
  id: string; category_id: string | null; name: string; name_bn: string | null;
  emoji_char: string | null; image_url: string | null; price: number; is_featured: boolean;
};

function EmojiShopPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = useCurrency();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [balance, setBalance] = useState({ deposit: 0, winnings: 0 });
  const [activeCat, setActiveCat] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: c }, { data: i }, { data: bal }] = await Promise.all([
      supabase.from("emoji_categories").select("*").order("sort_order"),
      supabase.from("emoji_items").select("*").order("sort_order"),
      user ? supabase.from("balances").select("deposit_balance, winnings_balance").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    setCats(c ?? []);
    setItems(i ?? []);
    if (bal) setBalance({ deposit: Number(bal.deposit_balance ?? 0), winnings: Number(bal.winnings_balance ?? 0) });
    if (user) {
      const { data: ow } = await supabase.from("emoji_purchases").select("emoji_id").eq("user_id", user.id);
      setOwned(new Set((ow ?? []).map((r: any) => r.emoji_id)));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const buy = async (it: Item) => {
    setBusy(it.id);
    const { error } = await supabase.rpc("purchase_emoji", { _emoji_id: it.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "কিনেছেন!" : "Purchased!");
    load();
  };

  const filtered = activeCat === "all" ? items : items.filter((i) => i.category_id === activeCat);
  const total = balance.deposit + balance.winnings;

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/profile"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <ShoppingBag className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "ইমোজি শপ" : "Emoji Shop"}</h1>
      </div>

      <Card className="p-3 flex items-center justify-between bg-gradient-to-r from-primary/15 to-transparent border-primary/30">
        <div className="text-xs text-muted-foreground">{lang === "bn" ? "আপনার ব্যালেন্স" : "Your balance"}</div>
        <div className="flex items-center gap-1.5 font-bold">
          <Coins className="h-4 w-4 text-yellow-500" /> {c}{total.toLocaleString()}
        </div>
      </Card>

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        <CatChip label={lang === "bn" ? "সব" : "All"} active={activeCat === "all"} onClick={() => setActiveCat("all")} />
        {cats.map((c) => (
          <CatChip
            key={c.id}
            label={lang === "bn" ? (c.name_bn ?? c.name) : c.name}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {filtered.map((it) => {
          const isOwned = owned.has(it.id);
          return (
            <Card key={it.id} className={`p-2.5 text-center space-y-1.5 relative ${it.is_featured ? "border-primary/40" : ""}`}>
              {it.is_featured && (
                <Badge className="absolute -top-1.5 -right-1 text-[8px] py-0 h-4">★</Badge>
              )}
              <div className="text-4xl py-2 select-none">
                {it.image_url
                  ? <img src={it.image_url} alt={it.name} className="h-10 w-10 mx-auto" />
                  : (it.emoji_char ?? "✨")}
              </div>
              <div className="text-[10px] font-medium truncate">
                {lang === "bn" ? (it.name_bn ?? it.name) : it.name}
              </div>
              {isOwned ? (
                <Badge variant="secondary" className="text-[9px] gap-0.5 w-full justify-center">
                  <Check className="h-2.5 w-2.5" /> {lang === "bn" ? "মালিক" : "Owned"}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-[11px] w-full"
                  disabled={busy === it.id || (it.price > 0 && total < it.price)}
                  onClick={() => buy(it)}
                >
                  {busy === it.id ? "…" : it.price === 0 ? (lang === "bn" ? "ফ্রি" : "Free") : `${c}${it.price}`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          {lang === "bn" ? "কোনো ইমোজি নেই" : "No emojis here"}
        </p>
      )}
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}