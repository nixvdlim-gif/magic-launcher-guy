import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Search, Shield, Ban, CheckCircle2, Users, Wallet, Image as ImageIcon, Trash2, Plus, Trophy, Bot, UserCheck, Ticket, BadgeCheck, Megaphone, MessageSquare, HeadphonesIcon, Smile, Pin, PinOff, Palette, RotateCcw, DollarSign, Gamepad2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getTwilioSettings, saveTwilioSettings } from "@/lib/twilio.functions";
import { getFincraSettings, saveFincraSettings } from "@/lib/fincra.functions";

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import { CURRENCY_PRESETS, useCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const nav = useNavigate();

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/profile" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{t("admin_panel")}</h1>
      </div>

      <DashboardStats />

      <Tabs defaultValue="deposits" className="w-full mt-4">
        <TabsList className="grid grid-cols-4 w-full mb-2">
          <TabsTrigger value="deposits" className="text-[10px]">Deposits</TabsTrigger>
          <TabsTrigger value="withdraws" className="text-[10px]">Withdraws</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px]">Users</TabsTrigger>
          <TabsTrigger value="banners" className="text-[10px]">Banners</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-3 w-full mb-2">
          <TabsTrigger value="payments" className="text-[10px]">Payments</TabsTrigger>
          <TabsTrigger value="app" className="text-[10px]">App Config</TabsTrigger>
          <TabsTrigger value="twilio" className="text-[10px]">SMS</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-2 w-full mb-2">
          <TabsTrigger value="modes" className="text-[10px]">
            <Gamepad2 className="h-3 w-3 mr-1 inline" />Game Modes
          </TabsTrigger>
          <TabsTrigger value="royal" className="text-[10px]">
            <Trophy className="h-3 w-3 mr-1 inline" />Royal Steps
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-3 w-full mb-4">
          <TabsTrigger value="tournaments" className="text-[10px]">Tourneys</TabsTrigger>
          <TabsTrigger value="bots" className="text-[10px]">Bots</TabsTrigger>
          <TabsTrigger value="agents" className="text-[10px]">Agents</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="coupons" className="text-[10px]">Coupons</TabsTrigger>
          <TabsTrigger value="kyc" className="text-[10px]">KYC</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-4 w-full mb-4">
          <TabsTrigger value="broadcast" className="text-[10px]">Broadcast</TabsTrigger>
          <TabsTrigger value="support" className="text-[10px]">Support</TabsTrigger>
          <TabsTrigger value="chatmod" className="text-[10px]">Chat</TabsTrigger>
          <TabsTrigger value="emojis" className="text-[10px]">Emojis</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-1 w-full mb-4">
          <TabsTrigger value="theme" className="text-[10px]">
            <Palette className="h-3 w-3 mr-1 inline" />Theme
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-1 w-full mb-4">
          <TabsTrigger value="commission" className="text-[10px]">
            <DollarSign className="h-3 w-3 mr-1 inline" />Commission Earnings
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-1 w-full mb-4">
          <TabsTrigger value="analytics" className="text-[10px]">
            📊 Analytics
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="security" className="text-[10px]">
            🔐 Security / Cron
          </TabsTrigger>
          <TabsTrigger value="quickteller" className="text-[10px]">
            ⚡ Fincra
          </TabsTrigger>
          <TabsTrigger value="liveboard" className="text-[10px]">📊 Live Board</TabsTrigger>
          <TabsTrigger value="fxcasino" className="text-[10px]">📈 FX Casino</TabsTrigger>
        </TabsList>



        <TabsContent value="deposits"><PendingTxnList type="deposit" /></TabsContent>
        <TabsContent value="withdraws"><PendingTxnList type="withdraw" /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="banners"><BannersTab /></TabsContent>
        <TabsContent value="payments"><PaymentSettingsTab /></TabsContent>
        <TabsContent value="app"><AppSettingsTab /></TabsContent>
        <TabsContent value="twilio"><TwilioSettingsTab /></TabsContent>
        <TabsContent value="modes"><GameModesTab /></TabsContent>
        <TabsContent value="royal"><RoyalStepsTab /></TabsContent>
        <TabsContent value="tournaments"><TournamentsAdminTab /></TabsContent>
        <TabsContent value="bots"><BotsAdminTab /></TabsContent>
        <TabsContent value="agents"><AgentsAdminTab /></TabsContent>
        <TabsContent value="coupons"><CouponsAdminTab /></TabsContent>
        <TabsContent value="kyc"><KycAdminTab /></TabsContent>
        <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
        <TabsContent value="support"><SupportAdminTab /></TabsContent>
        <TabsContent value="chatmod"><ChatModTab /></TabsContent>
        <TabsContent value="emojis"><EmojisAdminTab /></TabsContent>
        <TabsContent value="theme"><ThemeAdminTab /></TabsContent>
        <TabsContent value="commission"><CommissionTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="quickteller"><FincraSettingsTab /></TabsContent>
        <TabsContent value="liveboard"><LiveBoardTab /></TabsContent>
        <TabsContent value="fxcasino"><FxCasinoTab /></TabsContent>


      </Tabs>
    </div>
  );
}

// ── Dashboard stats ──────────────────────────────────────────────
function DashboardStats() {
  const c = useCurrency();
  const [stats, setStats] = useState<{ users: number; pendingD: number; pendingW: number; today: number } | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const [{ count: users }, { count: pendingD }, { count: pendingW }, { data: today }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "deposit").eq("status", "pending"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "withdraw").eq("status", "pending"),
        supabase.from("transactions").select("amount").eq("type", "deposit").eq("status", "approved").gte("processed_at", since.toISOString()),
      ]);
      const todayVol = (today ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      setStats({ users: users ?? 0, pendingD: pendingD ?? 0, pendingW: pendingW ?? 0, today: todayVol });
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard icon={<Users className="h-4 w-4" />} label="Total Users" value={stats?.users ?? "…"} />
      <StatCard icon={<Wallet className="h-4 w-4" />} label="Today Deposits" value={`${c}${(stats?.today ?? 0).toLocaleString()}`} />
      <StatCard icon={<Check className="h-4 w-4 text-yellow-500" />} label="Pending Deposits" value={stats?.pendingD ?? "…"} highlight={!!stats?.pendingD} />
      <StatCard icon={<X className="h-4 w-4 text-yellow-500" />} label="Pending Withdraws" value={stats?.pendingW ?? "…"} highlight={!!stats?.pendingW} />
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: any; highlight?: boolean }) {
  return (
    <Card className={`p-3 ${highlight ? "border-yellow-500/50 bg-yellow-500/5" : ""}`}>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );
}

// ── App settings (transfer + referral) ───────────────────────────
const DEFAULT_BETS: Record<string, number[]> = { classic: [10, 20, 50, 100, 250, 500], speed: [20, 50, 100, 200], quick: [50, 100, 200], time: [100, 200, 500] };

function AppSettingsTab() {
  const [transfer, setTransfer] = useState<any>({ enabled: true, fee_percent: 5, min_amount: 50, max_amount: 25000 });
  const [referral, setReferral] = useState<any>({ enabled: true, min_deposit: 100, l1_percent: 5, l2_percent: 2, l3_percent: 1 });
  const [currency, setCurrency] = useState<{ symbol: string; code: string }>({ symbol: "৳", code: "BDT" });
  const [bets, setBets] = useState<Record<string, number[]>>(DEFAULT_BETS);
  const [languages, setLanguages] = useState<{ bn: boolean; en: boolean; hi: boolean }>({ bn: false, en: true, hi: false });
  const [showClaimAdmin, setShowClaimAdmin] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["transfer", "referral", "currency", "bet_amounts", "languages", "show_claim_admin"]);
      for (const row of data ?? []) {
        if (row.key === "transfer") setTransfer({ ...transfer, ...(row.value as any) });
        if (row.key === "referral") setReferral({ ...referral, ...(row.value as any) });
        if (row.key === "currency") setCurrency({ symbol: "৳", code: "BDT", ...(row.value as any) });
        if (row.key === "bet_amounts") setBets({ ...DEFAULT_BETS, ...(row.value as any) });
        if (row.key === "languages") {
          const v = row.value as any;
          setLanguages({ bn: false, en: v?.en !== false, hi: false });
        }
        if (row.key === "show_claim_admin") setShowClaimAdmin(Boolean((row.value as any)?.enabled));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!languages.en) return toast.error("English must be enabled");
    setBusy(true);
    const { error: e1 } = await supabase.from("app_settings").upsert({ key: "transfer", value: transfer, updated_at: new Date().toISOString() });
    const { error: e2 } = await supabase.from("app_settings").upsert({ key: "referral", value: referral, updated_at: new Date().toISOString() });
    const { error: e3 } = await supabase.from("app_settings").upsert({ key: "currency", value: currency, updated_at: new Date().toISOString() });
    const { error: e4 } = await supabase.from("app_settings").upsert({ key: "bet_amounts", value: bets, updated_at: new Date().toISOString() });
    const { error: e5 } = await supabase.from("app_settings").upsert({ key: "languages", value: { bn: false, en: true, hi: false }, updated_at: new Date().toISOString() });
    const { error: e6 } = await supabase.from("app_settings").upsert({ key: "show_claim_admin", value: { enabled: showClaimAdmin }, updated_at: new Date().toISOString() });
    setBusy(false);
    if (e1 || e2 || e3 || e4 || e5 || e6) return toast.error((e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6)!.message);
    toast.success("Settings saved");
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading…</p>;


  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="font-bold">Language (site-wide)</div>
        <p className="text-[10px] text-muted-foreground">The app is currently set to English only.</p>
        <div className="flex items-center justify-between">
          <span className="text-sm">EN · English</span>
          <Switch checked disabled />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-bold">Currency (site-wide)</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <Label className="text-[10px]">Symbol</Label>
            <Input value={currency.symbol} maxLength={6} onChange={(e) => setCurrency({ ...currency, symbol: e.target.value })} className="h-9 text-center font-bold text-base" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">Code</Label>
            <Input value={currency.code} maxLength={8} onChange={(e) => setCurrency({ ...currency, code: e.target.value.toUpperCase() })} className="h-9" placeholder="e.g. BDT, USD, INR" />
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {CURRENCY_PRESETS.slice(0, 18).map((p) => (
            <button
              key={p.code + p.symbol}
              type="button"
              onClick={() => setCurrency({ symbol: p.symbol, code: p.code })}
              className={`rounded-md border px-1 py-1.5 text-[10px] leading-tight ${currency.code === p.code ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted"}`}
            >
              <div className="font-bold">{p.symbol}</div>
              <div className="opacity-70">{p.code}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Changes apply across the whole app in real-time.</p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold">P2P Transfer</div>
          <Switch checked={transfer.enabled} onCheckedChange={(v) => setTransfer({ ...transfer, enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Fee %" value={transfer.fee_percent} onChange={(v) => setTransfer({ ...transfer, fee_percent: v })} />
          <NumField label={`Min ${currency.symbol}`} value={transfer.min_amount} onChange={(v) => setTransfer({ ...transfer, min_amount: v })} />
          <NumField label={`Max ${currency.symbol}`} value={transfer.max_amount} onChange={(v) => setTransfer({ ...transfer, max_amount: v })} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold">Referral Commissions</div>
          <Switch checked={referral.enabled} onCheckedChange={(v) => setReferral({ ...referral, enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label={`Min Deposit ${currency.symbol}`} value={referral.min_deposit} onChange={(v) => setReferral({ ...referral, min_deposit: v })} />
          <NumField label="L1 %" value={referral.l1_percent} onChange={(v) => setReferral({ ...referral, l1_percent: v })} />
          <NumField label="L2 %" value={referral.l2_percent} onChange={(v) => setReferral({ ...referral, l2_percent: v })} />
          <NumField label="L3 %" value={referral.l3_percent} onChange={(v) => setReferral({ ...referral, l3_percent: v })} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-bold">Bet Amounts (per game mode)</div>
        <p className="text-[10px] text-muted-foreground">Add any custom bid value. Click ✕ to remove. Don't forget to press "Save All" below.</p>
        {(["classic", "speed", "quick", "time"] as const).map((m) => (
          <BetAmountEditor
            key={m}
            label={`${m} Ludo`}
            symbol={currency.symbol}
            values={bets[m] ?? []}
            onChange={(arr) => setBets({ ...bets, [m]: arr })}
          />
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-bold">Profile Page</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Show "Claim First Admin" button</div>
            <p className="text-[10px] text-muted-foreground">Hidden by default. Enable only when bootstrapping the first admin.</p>
          </div>
          <Switch checked={showClaimAdmin} onCheckedChange={setShowClaimAdmin} />
        </div>
      </Card>

      <Button className="w-full" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save All"}
      </Button>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9" />
    </div>
  );
}

function BetAmountEditor({ label, symbol, values, onChange }: { label: string; symbol: string; values: number[]; onChange: (arr: number[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const n = Number(draft.trim());
    if (!Number.isFinite(n) || n <= 0) return;
    if (values.includes(n)) { setDraft(""); return; }
    onChange([...values, n].sort((a, b) => a - b));
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] capitalize">{label} ({symbol})</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-[10px] text-muted-foreground italic">No bid amounts yet</span>}
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {symbol}{v}
            <button
              type="button"
              className="hover:text-destructive ml-0.5"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Custom amount (e.g. 750)"
          className="h-9"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-9 px-2">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Banners ──────────────────────────────────────────────────────
function BannersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("banners").select("*").order("sort_order").order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const addNew = async () => {
    const { error } = await supabase.from("banners").insert({ title: "New Banner", subtitle: "", image_url: "", link_url: "" });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (b: any) => {
    setBusy(b.id);
    const { error } = await supabase.from("banners").update({
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link_url: b.link_url,
      is_active: b.is_active,
      sort_order: Number(b.sort_order) || 0,
    }).eq("id", b.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Banner
      </Button>
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No banners yet</p>}
      {rows.map((b) => (
        <Card key={b.id} className="p-3 space-y-2">
          {b.image_url && (
            <img src={b.image_url} alt={b.title} className="w-full h-24 object-cover rounded" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px]">Title</Label>
              <Input value={b.title} onChange={(e) => update(b.id, { title: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Subtitle</Label>
              <Input value={b.subtitle ?? ""} onChange={(e) => update(b.id, { subtitle: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Image URL</Label>
              <Input value={b.image_url ?? ""} onChange={(e) => update(b.id, { image_url: e.target.value })} className="h-9 text-xs" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Link URL</Label>
              <Input value={b.link_url ?? ""} onChange={(e) => update(b.id, { link_url: e.target.value })} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Sort</Label>
              <Input type="number" value={b.sort_order} onChange={(e) => update(b.id, { sort_order: e.target.value })} className="h-9" />
            </div>
            <div className="flex items-end gap-2 text-xs">
              <Switch checked={b.is_active} onCheckedChange={(v) => update(b.id, { is_active: v })} />
              <span>Active</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === b.id} onClick={() => save(b)}>
              {busy === b.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(b.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Broadcast notifications ──────────────────────────────────────
function BroadcastTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    const { data, error } = await supabase.rpc("broadcast_notification" as any, {
      _title: title,
      _body: body || null,
      _link: link || null,
      _type: "system" as any,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${data ?? 0} users`);
    setTitle(""); setBody(""); setLink("");
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <div className="font-bold">Broadcast Notification</div>
      </div>
      <div>
        <Label className="text-[11px]">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Big update!" className="h-9" />
      </div>
      <div>
        <Label className="text-[11px]">Body</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Optional details" />
      </div>
      <div>
        <Label className="text-[11px]">Link (optional)</Label>
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/tournaments" className="h-9" />
      </div>
      <Button className="w-full" disabled={busy} onClick={send}>
        {busy ? "Sending…" : "Send to all users"}
      </Button>
    </Card>
  );
}

// ── Support tickets admin ────────────────────────────────────────
function SupportAdminTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("support_tickets").select("*")
      .order("last_message_at", { ascending: false }).limit(50);
    const ids = [...new Set((data ?? []).map((t) => t.user_id))];
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, username, game_id").in("id", ids)
      : { data: [] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setRows((data ?? []).map((t) => ({ ...t, profile: map.get(t.user_id) })));
  };
  useEffect(() => { load(); }, []);

  const open = async (t: any) => {
    setActive(t);
    const { data } = await supabase.from("support_messages").select("*")
      .eq("ticket_id", t.id).order("created_at");
    setMsgs(data ?? []);
  };

  const send = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: active.id, sender_id: u.user!.id, is_admin: true, body: reply.trim(),
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    await supabase.from("support_tickets").update({
      last_message_at: new Date().toISOString(),
    }).eq("id", active.id);
    setReply("");
    setBusy(false);
    open(active);
  };

  const setStatus = async (status: "open" | "closed") => {
    if (!active) return;
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success(status);
    setActive({ ...active, status });
    load();
  };

  if (active) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="p-3">
          <div className="font-bold">{active.subject}</div>
          <div className="text-[11px] text-muted-foreground">
            {active.profile?.username} · #{active.profile?.game_id} · {active.status}
          </div>
        </Card>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {msgs.map((m) => (
            <div key={m.id} className={`p-2 rounded-lg text-sm ${m.is_admin ? "bg-primary/10 ml-6" : "bg-secondary/40 mr-6"}`}>
              <div className="text-[9px] uppercase text-muted-foreground">{m.is_admin ? "Admin" : "User"}</div>
              {m.body}
            </div>
          ))}
        </div>
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply…" />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={send}>Send</Button>
          {active.status === "open"
            ? <Button variant="outline" onClick={() => setStatus("closed")}>Close</Button>
            : <Button variant="outline" onClick={() => setStatus("open")}>Reopen</Button>}
        </div>
      </div>
    );
  }

  if (rows.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">No tickets</p>;

  return (
    <div className="space-y-2">
      {rows.map((t) => (
        <Card key={t.id} className="p-3 cursor-pointer" onClick={() => open(t)}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{t.subject}</div>
              <div className="text-[11px] text-muted-foreground">
                {t.profile?.username ?? "?"} · #{t.profile?.game_id ?? "—"}
              </div>
            </div>
            <Badge variant={t.status === "open" ? "default" : "outline"} className="text-[9px] uppercase">{t.status}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Chat moderation ──────────────────────────────────────────────
function ChatModTab() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("chat_messages").select("*")
      .eq("is_deleted", false).order("created_at", { ascending: false }).limit(50);
    const ids = [...new Set((data ?? []).map((m) => m.user_id))];
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, username, game_id").in("id", ids)
      : { data: [] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setRows((data ?? []).map((m) => ({ ...m, profile: map.get(m.user_id) })));
  };
  useEffect(() => { load(); }, []);

  const togglePin = async (m: any) => {
    if (!m.is_pinned) {
      // unpin all others first
      await supabase.from("chat_messages").update({ is_pinned: false }).eq("is_pinned", true);
    }
    const { error } = await supabase.from("chat_messages").update({ is_pinned: !m.is_pinned }).eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const blockUser = async (uid: string) => {
    if (!confirm("Block this user from chat?")) return;
    const { error } = await supabase.from("profiles").update({ is_blocked: true }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success("User blocked");
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No messages</p>}
      {rows.map((m) => (
        <Card key={m.id} className={`p-3 ${m.is_pinned ? "border-primary/50" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground">
                {m.profile?.username ?? "?"} · #{m.profile?.game_id ?? "—"}
              </div>
              <div className="text-sm break-words">{m.body}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => togglePin(m)}>
                {m.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(m.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => blockUser(m.user_id)}>
                <Ban className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Emojis admin ─────────────────────────────────────────────────
function EmojisAdminTab() {
  const c = useCurrency();
  const [cats, setCats] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from("emoji_categories").select("*").order("sort_order"),
      supabase.from("emoji_items").select("*").order("sort_order"),
    ]);
    setCats(c ?? []);
    setRows(i ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const { error } = await supabase.from("emoji_items").insert({
      name: "New emoji", emoji_char: "😀", price: 0, category_id: cats[0]?.id ?? null,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (e: any) => {
    setBusy(e.id);
    const { error } = await supabase.from("emoji_items").update({
      name: e.name, name_bn: e.name_bn, emoji_char: e.emoji_char, image_url: e.image_url,
      price: Number(e.price) || 0, is_active: e.is_active, is_featured: e.is_featured,
      category_id: e.category_id, sort_order: Number(e.sort_order) || 0,
    }).eq("id", e.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete emoji?")) return;
    const { error } = await supabase.from("emoji_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Emoji
      </Button>
      {rows.map((e) => (
        <Card key={e.id} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{e.emoji_char ?? "🙂"}</span>
            <Input value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })} className="h-9 flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Char</Label>
              <Input value={e.emoji_char ?? ""} onChange={(ev) => update(e.id, { emoji_char: ev.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Price {c}</Label>
              <Input type="number" value={e.price} onChange={(ev) => update(e.id, { price: ev.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Sort</Label>
              <Input type="number" value={e.sort_order} onChange={(ev) => update(e.id, { sort_order: ev.target.value })} className="h-9" />
            </div>
            <div className="col-span-3">
              <Label className="text-[10px]">Category</Label>
              <select value={e.category_id ?? ""} onChange={(ev) => update(e.id, { category_id: ev.target.value || null })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— none —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <Label className="text-[10px]">Bangla name</Label>
              <Input value={e.name_bn ?? ""} onChange={(ev) => update(e.id, { name_bn: ev.target.value })} className="h-9" />
            </div>
            <div className="flex items-end gap-2 text-xs">
              <Switch checked={e.is_active} onCheckedChange={(v) => update(e.id, { is_active: v })} />
              <span>Active</span>
            </div>
            <div className="flex items-end gap-2 text-xs col-span-2">
              <Switch checked={e.is_featured} onCheckedChange={(v) => update(e.id, { is_featured: v })} />
              <span>Featured</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === e.id} onClick={() => save(e)}>
              {busy === e.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(e.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Coupons admin ────────────────────────────────────────────────
function CouponsAdminTab() {
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const code = "LUDO" + Math.floor(Math.random() * 9000 + 1000);
    const { error } = await supabase.from("coupons").insert({ code, type: "cash", amount: 50, max_uses: 100 });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (c: any) => {
    setBusy(c.id);
    const { error } = await supabase.from("coupons").update({
      code: c.code.toUpperCase(), type: c.type, amount: Number(c.amount) || 0,
      max_uses: Number(c.max_uses) || 1, is_active: c.is_active, description: c.description,
    }).eq("id", c.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Coupon
      </Button>
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No coupons yet</p>}
      {rows.map((c) => (
        <Card key={c.id} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <Input value={c.code} onChange={(e) => update(c.id, { code: e.target.value.toUpperCase() })} className="h-9 font-mono uppercase" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Type</Label>
              <select value={c.type} onChange={(e) => update(c.id, { type: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="cash">Cash</option>
                <option value="deposit_bonus">Deposit Bonus</option>
                <option value="spin">Spin</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Amount {c}</Label>
              <Input type="number" value={c.amount} onChange={(e) => update(c.id, { amount: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Max Uses</Label>
              <Input type="number" value={c.max_uses} onChange={(e) => update(c.id, { max_uses: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-3">
              <Label className="text-[10px]">Description</Label>
              <Input value={c.description ?? ""} onChange={(e) => update(c.id, { description: e.target.value })} className="h-9" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Switch checked={c.is_active} onCheckedChange={(v) => update(c.id, { is_active: v })} />
              <span>Active</span>
            </div>
            <span className="text-muted-foreground">Used {c.used_count}/{c.max_uses}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === c.id} onClick={() => save(c)}>
              {busy === c.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── KYC admin ────────────────────────────────────────────────────
function KycAdminTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: subs } = await supabase.from("kyc_submissions").select("*")
      .eq("status", "pending").order("created_at", { ascending: false });
    const ids = [...new Set((subs ?? []).map((s) => s.user_id))];
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, username, game_id").in("id", ids)
      : { data: [] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    // Resolve signed URLs for private kyc-docs paths (or keep legacy public URLs)
    const resolved = await Promise.all((subs ?? []).map(async (s) => {
      const sign = async (v: string | null) => {
        if (!v) return null;
        if (v.startsWith("http")) return v; // legacy public URL
        const { data } = await supabase.storage.from("kyc-docs").createSignedUrl(v, 600);
        return data?.signedUrl ?? null;
      };
      return {
        ...s,
        profile: map.get(s.user_id),
        doc_image_url: await sign(s.doc_image_url),
        selfie_url: await sign(s.selfie_url),
      };
    }));
    setRows(resolved);
  };
  useEffect(() => { load(); }, []);

  const act = async (s: any, status: "approved" | "rejected") => {
    setBusy(s.id);
    const { error } = await supabase.from("kyc_submissions").update({
      status, admin_note: note[s.id] || null,
    }).eq("id", s.id);
    if (!error && status === "approved") {
      await supabase.from("profiles").update({ is_verified: true }).eq("id", s.user_id);
    }
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status);
    load();
  };

  if (rows.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">No pending KYC</p>;

  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <Card key={s.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{s.profile?.username ?? "?"}</div>
              <div className="text-[10px] text-muted-foreground font-mono">#{s.profile?.game_id ?? "—"}</div>
            </div>
            <Badge variant="outline" className="uppercase">{s.doc_type}</Badge>
          </div>
          <div className="text-xs">Doc #: <span className="font-mono">{s.doc_number}</span></div>
          <div className="grid grid-cols-2 gap-2">
            {s.doc_image_url && <a href={s.doc_image_url} target="_blank" rel="noreferrer"><img src={s.doc_image_url} className="h-24 w-full object-cover rounded" /></a>}
            {s.selfie_url && <a href={s.selfie_url} target="_blank" rel="noreferrer"><img src={s.selfie_url} className="h-24 w-full object-cover rounded" /></a>}
          </div>
          <Textarea placeholder="Note (optional)" value={note[s.id] ?? ""} rows={2}
            onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={busy === s.id} onClick={() => act(s, "approved")}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" disabled={busy === s.id} onClick={() => act(s, "rejected")}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Bots admin ───────────────────────────────────────────────────
function BotsAdminTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const { error } = await supabase.from("bots").insert({ name: "Bot " + Math.floor(Math.random() * 1000), skill_level: 5 });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (b: any) => {
    setBusy(b.id);
    const { error } = await supabase.from("bots").update({
      name: b.name, avatar_url: b.avatar_url,
      skill_level: Math.max(1, Math.min(10, Number(b.skill_level) || 5)),
      is_active: b.is_active,
    }).eq("id", b.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete bot?")) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <BotMatchConfig />
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Bot
      </Button>
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No bots yet</p>}
      {rows.map((b) => (
        <Card key={b.id} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <Input value={b.name} onChange={(e) => update(b.id, { name: e.target.value })} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Skill (1-10)</Label>
              <Input type="number" min={1} max={10} value={b.skill_level}
                onChange={(e) => update(b.id, { skill_level: e.target.value })} className="h-9" />
            </div>
            <div className="flex items-end gap-2 text-xs">
              <Switch checked={b.is_active} onCheckedChange={(v) => update(b.id, { is_active: v })} />
              <span>Active</span>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Avatar URL</Label>
              <Input value={b.avatar_url ?? ""} onChange={(e) => update(b.id, { avatar_url: e.target.value })} className="h-9 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === b.id} onClick={() => save(b)}>
              {busy === b.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(b.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Agents admin ─────────────────────────────────────────────────
function AgentsAdminTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("agents").select("*").order("sort_order").order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const { error } = await supabase.from("agents").insert({ name: "New Agent" });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (a: any) => {
    setBusy(a.id);
    const { error } = await supabase.from("agents").update({
      name: a.name, phone: a.phone, whatsapp: a.whatsapp, area: a.area, notes: a.notes,
      is_active: a.is_active, sort_order: Number(a.sort_order) || 0,
    }).eq("id", a.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    const ok = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Delete agent?")
      : true;
    if (!ok) return;
    setBusy(id);
    const { error } = await supabase.from("agents").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setRows((r) => r.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Agent
      </Button>
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No agents yet</p>}
      {rows.map((a) => (
        <Card key={a.id} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <Input value={a.name} onChange={(e) => update(a.id, { name: e.target.value })} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Phone</Label>
              <Input value={a.phone ?? ""} onChange={(e) => update(a.id, { phone: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">WhatsApp</Label>
              <Input value={a.whatsapp ?? ""} onChange={(e) => update(a.id, { whatsapp: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Area</Label>
              <Input value={a.area ?? ""} onChange={(e) => update(a.id, { area: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Notes</Label>
              <Textarea value={a.notes ?? ""} onChange={(e) => update(a.id, { notes: e.target.value })} rows={2} />
            </div>
            <div>
              <Label className="text-[10px]">Sort</Label>
              <Input type="number" value={a.sort_order} onChange={(e) => update(a.id, { sort_order: e.target.value })} className="h-9" />
            </div>
            <div className="flex items-end gap-2 text-xs">
              <Switch checked={a.is_active} onCheckedChange={(v) => update(a.id, { is_active: v })} />
              <span>Active</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === a.id} onClick={() => save(a)}>
              {busy === a.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(a.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Pending transactions ──────────────────────────────────────────
function PendingTxnList({ type }: { type: "deposit" | "withdraw" }) {
  const { t } = useI18n();
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles!transactions_user_id_fkey(username, game_id)")
      .eq("type", type)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    // The FK alias may not exist — fallback: fetch profiles separately
    if (!data || data.length === 0 || !(data as any[])[0]?.profiles) {
      const { data: txns } = await supabase
        .from("transactions")
        .select("*")
        .eq("type", type)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const ids = [...new Set((txns ?? []).map((t) => t.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, username, game_id").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      setRows((txns ?? []).map((t) => ({ ...t, profile: map.get(t.user_id) })));
    } else {
      setRows(data.map((r: any) => ({ ...r, profile: r.profiles })));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [type]);

  const act = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const { data, error } = await supabase.rpc("admin_process_transaction" as any, {
      _txn_id: id,
      _action: status === "approved" ? "approve" : "reject",
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) return toast.error(res?.error ?? "Failed");
    toast.success(status === "approved" ? t("approved_msg") : t("rejected_msg"));
    load();
  };

  if (loading) return <p className="text-center text-sm text-muted-foreground py-6">…</p>;
  if (rows.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">{t("no_pending")}</p>;

  return (
    <div className="space-y-3">
      {rows.map((tx) => (
        <Card key={tx.id} className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-lg">{c}{Number(tx.amount).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {tx.profile?.username ?? "?"} · #{tx.profile?.game_id ?? "------"}
              </div>
            </div>
            <Badge variant="outline" className="uppercase text-[10px]">{tx.method}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/40 rounded-lg p-2">
            {tx.sender_number && <Field label="From" value={tx.sender_number} />}
            {tx.receiver_number && <Field label="To" value={tx.receiver_number} />}
            {tx.external_txn_id && <Field label="TrxID" value={tx.external_txn_id} />}
            {tx.bank_name && <Field label="Bank" value={tx.bank_name} />}
            {tx.bank_account_number && <Field label="A/C" value={tx.bank_account_number} />}
            {tx.bank_account_name && <Field label="A/C Name" value={tx.bank_account_name} />}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={busy === tx.id} onClick={() => act(tx.id, "approved")}>
              <Check className="h-4 w-4 mr-1" /> {t("approve")}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" disabled={busy === tx.id} onClick={() => act(tx.id, "rejected")}>
              <X className="h-4 w-4 mr-1" /> {t("reject")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-mono text-xs break-all">{value}</div>
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────
function UsersTab() {
  const { t } = useI18n();
  const c = useCurrency();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { _q: q.trim() || undefined, _limit: 100 });
    if (error) return toast.error(error.message);
    setRows(
      (data ?? []).map((u: any) => ({
        ...u,
        balance: { deposit_balance: u.deposit_balance, winnings_balance: u.winnings_balance },
      })),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const toggleBlock = async (id: string, current: boolean) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update({ is_blocked: !current }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    load();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={t("search")} className="pl-9 h-10" />
      </div>
      <div className="space-y-2">
        {rows.map((u) => (
          <Card key={u.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{u.username}</span>
                  {u.is_blocked && <Badge variant="destructive" className="text-[9px]">{t("blocked")}</Badge>}
                  {u.is_verified && <Badge className="text-[9px] bg-blue-600">✓</Badge>}
                  {u.roles?.includes("admin") && <Badge className="text-[9px] bg-purple-600">ADMIN</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">#{u.game_id} · {u.phone ?? u.email ?? "—"}</div>
                <div className="text-[11px] mt-1">
                  {c}{Number(u.balance?.deposit_balance ?? 0).toFixed(2)} dep + {c}{Number(u.balance?.winnings_balance ?? 0).toFixed(2)} win · {u.total_wins}W/{u.total_games}G
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditUser(u)}>
                  <Wallet className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={u.is_blocked ? "outline" : "destructive"}
                  disabled={busy === u.id}
                  onClick={() => toggleBlock(u.id, u.is_blocked)}
                >
                  {u.is_blocked ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <UserManageDialog user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />
    </div>
  );
}

function UserManageDialog({ user, onClose, onSaved }: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const c = useCurrency();
  const [username, setUsername] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deposit" | "winnings">("deposit");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setIsVerified(!!user.is_verified);
    setIsBlocked(!!user.is_blocked);
    setIsAdmin(!!user.roles?.includes("admin"));
    setAmount(""); setNote(""); setKind("deposit");
  }, [user]);

  if (!user) return null;

  const adjust = async (sign: 1 | -1) => {
    const amt = Number(amount) * sign;
    if (!amt || Number.isNaN(amt)) return toast.error("Enter amount");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_balance", {
      _user_id: user.id, _kind: kind, _amount: amt, _note: note || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok === false) return toast.error((data as any).error);
    toast.success(`${sign > 0 ? "Added" : "Removed"} ${Math.abs(amt)}`);
    setAmount(""); setNote("");
    onSaved();
  };

  const saveSettings = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_update_user", {
      _user_id: user.id,
      _username: username,
      _is_verified: isVerified,
      _is_blocked: isBlocked,
      _is_admin: isAdmin,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok === false) return toast.error((data as any).error);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user.username} · #{user.game_id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-3 space-y-2 bg-muted/40">
            <div className="text-xs text-muted-foreground">Current balance</div>
            <div className="text-sm">
              {c}{Number(user.balance?.deposit_balance ?? 0).toFixed(2)} deposit + {c}{Number(user.balance?.winnings_balance ?? 0).toFixed(2)} winnings
            </div>
          </Card>

          <div className="space-y-2 border rounded-md p-3">
            <div className="text-xs font-semibold flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Adjust Balance</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
              >
                <option value="deposit">Deposit</option>
                <option value="winnings">Winnings</option>
              </select>
              <Input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9"
              />
            </div>
            <Input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" disabled={busy} onClick={() => adjust(1)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
              <Button size="sm" disabled={busy} onClick={() => adjust(-1)} variant="destructive">
                <X className="h-4 w-4 mr-1" /> Subtract
              </Button>
            </div>
          </div>

          <div className="space-y-2 border rounded-md p-3">
            <div className="text-xs font-semibold">User Settings</div>
            <div>
              <Label className="text-[10px]">Username</Label>
              <Input className="h-9" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Verified</Label>
              <Switch checked={isVerified} onCheckedChange={setIsVerified} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Blocked</Label>
              <Switch checked={isBlocked} onCheckedChange={setIsBlocked} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Admin role</Label>
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={saveSettings} disabled={busy}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payment settings ─────────────────────────────────────────────
function PaymentSettingsTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPlan, setNewPlan] = useState<any>({
    method: "bkash",
    display_name: "",
    receive_number: "",
    icon: "💳",
    color: "#e2136e",
    instructions: "",
    min_deposit: 100,
    max_deposit: 25000,
    min_withdraw: 200,
    max_withdraw: 25000,
    deposit_enabled: true,
    withdraw_enabled: true,
  });

  const load = async () => {
    const { data } = await supabase.from("payment_settings").select("*").order("sort_order");
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const addPlan = async () => {
    if (!newPlan.display_name.trim()) return toast.error("Display name required");
    const { error } = await supabase.from("payment_settings").insert({
      method: newPlan.method,
      display_name: newPlan.display_name.trim(),
      receive_number: newPlan.receive_number || null,
      icon: newPlan.icon || null,
      color: newPlan.color || null,
      instructions: newPlan.instructions || null,
      min_deposit: Number(newPlan.min_deposit),
      max_deposit: Number(newPlan.max_deposit),
      min_withdraw: Number(newPlan.min_withdraw),
      max_withdraw: Number(newPlan.max_withdraw),
      deposit_enabled: newPlan.deposit_enabled,
      withdraw_enabled: newPlan.withdraw_enabled,
      sort_order: rows.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Plan added");
    setAdding(false);
    setNewPlan({ ...newPlan, display_name: "", receive_number: "", instructions: "" });
    load();
  };

  const removePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("payment_settings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (row: any) => {
    const { error } = await supabase
      .from("payment_settings")
      .update({
        receive_number: row.receive_number,
        instructions: row.instructions,
        min_deposit: Number(row.min_deposit),
        max_deposit: Number(row.max_deposit),
        min_withdraw: Number(row.min_withdraw),
        max_withdraw: Number(row.max_withdraw),
        deposit_enabled: row.deposit_enabled,
        withdraw_enabled: row.withdraw_enabled,
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
  };

  return (
    <div className="space-y-3">
      <Button size="sm" className="w-full" onClick={() => setAdding((a) => !a)}>
        <Plus className="h-4 w-4 mr-1" /> {adding ? "Cancel" : "Add Plan"}
      </Button>

      {adding && (
        <Card className="p-4 space-y-2 border-primary/40">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Method</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={newPlan.method}
                onChange={(e) => setNewPlan({ ...newPlan, method: e.target.value })}
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Display Name</Label>
              <Input className="h-9" value={newPlan.display_name} onChange={(e) => setNewPlan({ ...newPlan, display_name: e.target.value })} placeholder="e.g. bKash Personal" />
            </div>
            <div>
              <Label className="text-[10px]">Icon (emoji)</Label>
              <Input className="h-9" value={newPlan.icon} onChange={(e) => setNewPlan({ ...newPlan, icon: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px]">Color</Label>
              <Input className="h-9" value={newPlan.color} onChange={(e) => setNewPlan({ ...newPlan, color: e.target.value })} placeholder="#e2136e" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Receive Number</Label>
            <Input className="h-9" value={newPlan.receive_number} onChange={(e) => setNewPlan({ ...newPlan, receive_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Min D</Label><Input className="h-9" type="number" value={newPlan.min_deposit} onChange={(e) => setNewPlan({ ...newPlan, min_deposit: e.target.value })} /></div>
            <div><Label className="text-[10px]">Max D</Label><Input className="h-9" type="number" value={newPlan.max_deposit} onChange={(e) => setNewPlan({ ...newPlan, max_deposit: e.target.value })} /></div>
            <div><Label className="text-[10px]">Min W</Label><Input className="h-9" type="number" value={newPlan.min_withdraw} onChange={(e) => setNewPlan({ ...newPlan, min_withdraw: e.target.value })} /></div>
            <div><Label className="text-[10px]">Max W</Label><Input className="h-9" type="number" value={newPlan.max_withdraw} onChange={(e) => setNewPlan({ ...newPlan, max_withdraw: e.target.value })} /></div>
          </div>
          <div>
            <Label className="text-[11px]">Instructions</Label>
            <Textarea rows={2} value={newPlan.instructions} onChange={(e) => setNewPlan({ ...newPlan, instructions: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span>Deposit</span>
            <Switch checked={newPlan.deposit_enabled} onCheckedChange={(v) => setNewPlan({ ...newPlan, deposit_enabled: v })} />
            <span className="ml-2">Withdraw</span>
            <Switch checked={newPlan.withdraw_enabled} onCheckedChange={(v) => setNewPlan({ ...newPlan, withdraw_enabled: v })} />
          </div>
          <Button size="sm" className="w-full" onClick={addPlan}>Save New Plan</Button>
        </Card>
      )}

      {rows.map((r) => (
        <Card key={r.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold" style={{ color: r.color }}>{r.icon} {r.display_name}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">D</span>
              <Switch checked={r.deposit_enabled} onCheckedChange={(v) => update(r.id, { deposit_enabled: v })} />
              <span className="text-muted-foreground ml-2">W</span>
              <Switch checked={r.withdraw_enabled} onCheckedChange={(v) => update(r.id, { withdraw_enabled: v })} />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePlan(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-[11px]">{t("receive_number_label")}</Label>
              <Input value={r.receive_number ?? ""} onChange={(e) => update(r.id, { receive_number: e.target.value })} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Min D</Label>
                <Input type="number" value={r.min_deposit} onChange={(e) => update(r.id, { min_deposit: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px]">Max D</Label>
                <Input type="number" value={r.max_deposit} onChange={(e) => update(r.id, { max_deposit: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px]">Min W</Label>
                <Input type="number" value={r.min_withdraw} onChange={(e) => update(r.id, { min_withdraw: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px]">Max W</Label>
                <Input type="number" value={r.max_withdraw} onChange={(e) => update(r.id, { max_withdraw: e.target.value })} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">{t("instructions_label")}</Label>
              <Textarea rows={2} value={r.instructions ?? ""} onChange={(e) => update(r.id, { instructions: e.target.value })} />
            </div>
            <Button size="sm" className="w-full" onClick={() => save(r)}>{t("save")}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Twilio SMS settings ──────────────────────────────────────────
function TwilioSettingsTab() {
  const load = useServerFn(getTwilioSettings);
  const save = useServerFn(saveTwilioSettings);
  const [form, setForm] = useState({
    account_sid: "",
    auth_token: "",
    verify_service_sid: "",
    enabled: false,
  });
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load()
      .then((d) => {
        setForm({
          account_sid: d.account_sid,
          auth_token: d.auth_token,
          verify_service_sid: d.verify_service_sid,
          enabled: d.enabled,
        });
        setHasToken(d.has_token);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Twilio settings saved");
      setHasToken(!!form.auth_token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Twilio Verify (Phone OTP)</div>
          <div className="text-[11px] text-muted-foreground">
            Enable SMS verification for users
          </div>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(v) => setForm({ ...form, enabled: v })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">Account SID</Label>
        <Input
          value={form.account_sid}
          onChange={(e) => setForm({ ...form, account_sid: e.target.value })}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="h-9 font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">
          Auth Token {hasToken && <span className="text-primary">(saved)</span>}
        </Label>
        <Input
          type="password"
          value={form.auth_token}
          onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
          placeholder={hasToken ? "Leave blank to keep existing" : "Enter auth token"}
          className="h-9 font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px]">Verify Service SID</Label>
        <Input
          value={form.verify_service_sid}
          onChange={(e) => setForm({ ...form, verify_service_sid: e.target.value })}
          placeholder="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="h-9 font-mono text-xs"
        />
      </div>

      <div className="text-[11px] text-muted-foreground bg-secondary/40 p-2 rounded-md">
        Get keys from console.twilio.com → Verify → Services. Account SID & Auth Token are on the dashboard.
      </div>

      <Button className="w-full" disabled={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save Twilio Settings"}
      </Button>
    </Card>
  );
}

// ── Tournaments admin ────────────────────────────────────────────
function TournamentsAdminTab() {
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("tournaments").select("*").order("start_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const start = new Date(Date.now() + 86400_000).toISOString();
    const { error } = await supabase.from("tournaments").insert({
      name: "New Tournament", entry_fee: 50, prize_pool: 500, max_players: 16, start_at: start,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const update = (id: string, patch: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (t: any) => {
    setBusy(t.id);
    const { error } = await supabase.from("tournaments").update({
      name: t.name, description: t.description, banner_url: t.banner_url,
      entry_fee: Number(t.entry_fee) || 0, prize_pool: Number(t.prize_pool) || 0,
      max_players: Number(t.max_players) || 16, start_at: t.start_at, status: t.status,
      bots_enabled: !!t.bots_enabled,
    }).eq("id", t.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete tournament?")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const fillBots = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.rpc("fill_tournament_with_bots" as any, { _tid: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Added ${(data as any)?.added ?? 0} bots`);
  };

  const removeBots = async (id: string) => {
    if (!confirm("Remove all bots from this tournament?")) return;
    setBusy(id);
    const { data, error } = await supabase.rpc("remove_bots_from_tournament" as any, { _tid: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Removed ${(data as any)?.removed ?? 0} bots`);
  };

  return (
    <div className="space-y-3">
      <Button onClick={addNew} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" /> Add Tournament
      </Button>
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">None yet</p>}
      {rows.map((t) => (
        <Card key={t.id} className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px]">Name</Label>
              <Input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Description</Label>
              <Textarea value={t.description ?? ""} onChange={(e) => update(t.id, { description: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Banner URL</Label>
              <Input value={t.banner_url ?? ""} onChange={(e) => update(t.id, { banner_url: e.target.value })} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Entry {c}</Label>
              <Input type="number" value={t.entry_fee} onChange={(e) => update(t.id, { entry_fee: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Prize {c}</Label>
              <Input type="number" value={t.prize_pool} onChange={(e) => update(t.id, { prize_pool: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Max Players</Label>
              <Input type="number" value={t.max_players} onChange={(e) => update(t.id, { max_players: e.target.value })} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px]">Status</Label>
              <select value={t.status} onChange={(e) => update(t.id, { status: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="upcoming">upcoming</option>
                <option value="live">live</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Start At</Label>
              <Input type="datetime-local"
                value={t.start_at ? new Date(t.start_at).toISOString().slice(0,16) : ""}
                onChange={(e) => update(t.id, { start_at: new Date(e.target.value).toISOString() })}
                className="h-9" />
            </div>
            <div className="col-span-2 flex items-center justify-between bg-secondary/30 rounded-md px-3 py-2">
              <div>
                <Label className="text-[11px] font-semibold">Bots Enabled</Label>
                <p className="text-[10px] text-muted-foreground">Off = no bots will join or auto-play</p>
              </div>
              <Switch
                checked={t.bots_enabled !== false}
                onCheckedChange={(v) => update(t.id, { bots_enabled: v })}
              />
            </div>
            {t.bots_enabled !== false && (
              <div className="col-span-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]"
                  disabled={busy === t.id} onClick={() => fillBots(t.id)}>
                  Fill with Bots
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]"
                  disabled={busy === t.id} onClick={() => removeBots(t.id)}>
                  Remove All Bots
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy === t.id} onClick={() => save(t)}>
              {busy === t.id ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => remove(t.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Theme editor ─────────────────────────────────────────────
// Stores full CSS color values (any format CSS accepts: hex, oklch(...), hsl(...), rgb(...))
// Defaults match src/styles.css :root tokens.
const THEME_TOKENS: { key: string; label: string; hex: string }[] = [
  { key: "background",          label: "Background",          hex: "#0D0221" },
  { key: "foreground",          label: "Foreground (text)",   hex: "#FFFFFF" },
  { key: "card",                label: "Card",                hex: "#1A0B2E" },
  { key: "card_foreground",     label: "Card Text",           hex: "#FFFFFF" },
  { key: "primary",             label: "Primary (Neon Green)", hex: "#00FF87" },
  { key: "primary_foreground",  label: "Primary Text",        hex: "#0D0221" },
  { key: "secondary",           label: "Secondary (Violet)",  hex: "#8338EC" },
  { key: "secondary_foreground",label: "Secondary Text",      hex: "#FFFFFF" },
  { key: "accent",              label: "Accent (Blue)",       hex: "#3A86FF" },
  { key: "accent_foreground",   label: "Accent Text",         hex: "#FFFFFF" },
  { key: "muted",               label: "Muted",               hex: "#2A1B3D" },
  { key: "muted_foreground",    label: "Muted Text",          hex: "#B8A6CC" },
  { key: "gold",                label: "Gold (Lime Yellow)",  hex: "#D4FF00" },
  { key: "gold_foreground",     label: "Gold Text",           hex: "#0D0221" },
  { key: "destructive",         label: "Destructive (Red)",   hex: "#FF3B5C" },
  { key: "success",             label: "Success",             hex: "#00FF87" },
  { key: "border",              label: "Border",              hex: "#3D2A55" },
  { key: "ring",                label: "Focus Ring",          hex: "#00FF87" },
];
const DEFAULT_THEME: Record<string, string> = Object.fromEntries(
  THEME_TOKENS.map((t) => [t.key, t.hex])
);

const THEME_PRESETS: { name: string; colors: Partial<Record<string, string>> }[] = [
  {
    name: "Neon Green",
    colors: { background: "#0D0221", primary: "#00FF87", secondary: "#8338EC", accent: "#3A86FF", gold: "#D4FF00", ring: "#00FF87" },
  },
  {
    name: "Royal Gold",
    colors: { background: "#1A0F00", primary: "#FFB800", secondary: "#7C2D12", accent: "#FF6B00", gold: "#FFD700", ring: "#FFB800" },
  },
  {
    name: "Ocean Blue",
    colors: { background: "#001F3F", primary: "#00D4FF", secondary: "#0077B6", accent: "#48CAE4", gold: "#FFD60A", ring: "#00D4FF" },
  },
  {
    name: "Fire Red",
    colors: { background: "#1A0000", primary: "#FF3B5C", secondary: "#FF6B00", accent: "#FFB800", gold: "#FFD700", ring: "#FF3B5C" },
  },
  {
    name: "Cyber Pink",
    colors: { background: "#0F0019", primary: "#FF006E", secondary: "#8338EC", accent: "#3A86FF", gold: "#FFBE0B", ring: "#FF006E" },
  },
  {
    name: "Emerald Lux",
    colors: { background: "#001A0F", primary: "#00C896", secondary: "#0E5C3A", accent: "#FFB800", gold: "#FFD700", ring: "#00C896" },
  },
];

function ThemeAdminTab() {
  const [theme, setTheme] = useState<Record<string, string>>(DEFAULT_THEME);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "theme").maybeSingle();
      if (data?.value) setTheme({ ...DEFAULT_THEME, ...(data.value as Record<string, string>) });
    })();
  }, []);

  const apply = (next: Record<string, string>) => {
    const root = document.documentElement;
    Object.entries(next).forEach(([k, v]) => {
      if (typeof v === "string" && v.length) root.style.setProperty(`--${k.replace(/_/g, "-")}`, v);
    });
  };

  const update = (k: string, v: string) => {
    const next = { ...theme, [k]: v };
    setTheme(next);
    apply(next);
  };

  const applyPreset = (preset: typeof THEME_PRESETS[number]) => {
    const next = { ...theme, ...preset.colors } as Record<string, string>;
    setTheme(next);
    apply(next);
    toast.success(`Preset applied: ${preset.name}`);
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "theme",
      value: theme,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Theme saved — live for all users");
  };

  const reset = () => {
    setTheme(DEFAULT_THEME);
    apply(DEFAULT_THEME);
    toast.success("Reset to default theme");
  };

  return (
    <div className="space-y-3">
      {/* Presets */}
      <Card className="p-3 space-y-2">
        <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold">
          Quick Presets
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-border p-2 text-left hover:border-primary transition"
              style={{ background: `linear-gradient(135deg, ${p.colors.background}, ${p.colors.primary}20)` }}
            >
              <div className="text-[11px] font-bold text-foreground">{p.name}</div>
              <div className="flex gap-1 mt-1.5">
                {[p.colors.primary, p.colors.secondary, p.colors.accent, p.colors.gold].map((c, i) => (
                  <div key={i} className="h-3 w-3 rounded-full border border-white/30" style={{ background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Color pickers */}
      <Card className="p-4 space-y-2">
        <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold">
          Custom Colors
        </div>
        <div className="text-[10px] text-muted-foreground mb-2">
          Click a color swatch or type a CSS value (hex / oklch / hsl). Saving will broadcast live to all users.
        </div>

        {THEME_TOKENS.map((t) => (
          <div key={t.key} className="grid grid-cols-[44px_1fr_120px] gap-2 items-center">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(theme[t.key] || "") ? theme[t.key] : t.hex}
              onChange={(e) => update(t.key, e.target.value)}
              className="h-9 w-11 rounded border border-border bg-transparent cursor-pointer p-0.5"
              aria-label={t.label}
            />
            <Input
              value={theme[t.key] || ""}
              onChange={(e) => update(t.key, e.target.value)}
              placeholder={t.hex}
              className="h-9 text-xs font-mono"
            />
            <Label className="text-[10px] text-muted-foreground truncate" title={t.label}>
              {t.label}
            </Label>
          </div>
        ))}

        <div className="flex gap-2 pt-3">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? "Saving..." : "Save & Apply Globally"}
          </Button>
          <Button onClick={reset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </Card>

      {/* Live preview */}
      <Card className="p-4 space-y-3">
        <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold">Live Preview</div>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <Card className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30">
          <div className="text-sm font-bold text-foreground">Sample card</div>
          <div className="text-xs text-muted-foreground">Background, foreground, primary & accent in action.</div>
          <div className="mt-2 inline-block px-2 py-1 rounded bg-gold text-gold-foreground text-[11px] font-bold">
            ★ Gold Badge
          </div>
        </Card>
      </Card>
    </div>
  );
}

// ── Commission earnings admin ────────────────────────────────────
function CommissionTab() {
  const c = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ today: number; week: number; all: number }>({ today: 0, week: 0, all: 0 });

  async function load() {
    const { data } = await supabase
      .from("commission_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as any[]) || []);

    const { data: rfs } = await supabase
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRefunds((rfs as any[]) || []);

    const all = (data as any[] | null)?.reduce((s, r) => s + Number(r.commission_amount || 0), 0) || 0;
    const now = Date.now();
    const today = (data as any[] | null)?.filter((r) => now - new Date(r.created_at).getTime() < 86400000)
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0) || 0;
    const week = (data as any[] | null)?.filter((r) => now - new Date(r.created_at).getTime() < 7 * 86400000)
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0) || 0;
    setTotals({ today, week, all });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center bg-gradient-to-br from-primary/20 to-accent/20">
          <div className="text-[10px] text-muted-foreground">Today</div>
          <div className="text-lg font-bold">{c}{totals.today.toFixed(2)}</div>
        </Card>
        <Card className="p-3 text-center bg-gradient-to-br from-primary/20 to-accent/20">
          <div className="text-[10px] text-muted-foreground">7 days</div>
          <div className="text-lg font-bold">{c}{totals.week.toFixed(2)}</div>
        </Card>
        <Card className="p-3 text-center bg-gradient-to-br from-primary/20 to-accent/20">
          <div className="text-[10px] text-muted-foreground">Total</div>
          <div className="text-lg font-bold">{c}{totals.all.toFixed(2)}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="text-sm font-bold mb-2">Recent commissions</div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.length === 0 && <div className="text-xs text-muted-foreground">No commissions yet</div>}
          {rows.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-xs border-b pb-1">
              <div>
                <div className="font-semibold">{r.mode} • {r.player_count}p</div>
                <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">+{c}{Number(r.commission_amount).toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">{r.commission_percent}% of {c}{r.pot_amount}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-sm font-bold mb-2">Recent refunds</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {refunds.length === 0 && <div className="text-xs text-muted-foreground">No refunds</div>}
          {refunds.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-xs border-b pb-1">
              <div>
                <div className="font-semibold">{c}{r.amount}</div>
                <div className="text-[10px] text-muted-foreground">{r.reason} • {new Date(r.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Security / Cron secret ─────────────────────────────
function SecurityTab() {
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "security")
        .maybeSingle();
      setSecret((data?.value as any)?.cron_secret ?? "");
      setLoading(false);
    })();
  }, []);

  const generate = () => {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    setSecret(Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join(""));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "security",
      value: { cron_secret: secret },
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div>
          <div className="font-semibold text-sm">Cron Secret</div>
          <div className="text-[11px] text-muted-foreground">
            Used to authenticate the auto-cleanup webhook (<code>/api/public/hooks/cleanup-rooms</code>).
            Send this value in the <code>x-cron-secret</code> header from your scheduler.
          </div>
        </div>
        <Input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Click Generate or paste a long random string"
          className="h-9 font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generate}>Generate</Button>
          <Button size="sm" onClick={save} disabled={saving || !secret}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {secret && (
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Copied"); }}>
              Copy
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Game Modes admin (enable/disable mode + 2P/4P) ───────────────
type GMCfg = { enabled: boolean; p2: boolean; p4: boolean };
type GMMap = Record<"classic" | "speed" | "quick" | "time", GMCfg>;
const DEFAULT_GM: GMMap = {
  classic: { enabled: true, p2: true, p4: true },
  speed:   { enabled: true, p2: true, p4: true },
  quick:   { enabled: true, p2: true, p4: true },
  time:    { enabled: true, p2: true, p4: true },
};
const MODE_LABELS: Record<keyof GMMap, string> = {
  classic: "Classic Ludo",
  speed: "Speed Ludo",
  quick: "Quick Ludo",
  time: "Time Ludo",
};

function GameModesTab() {
  const [cfg, setCfg] = useState<GMMap>(DEFAULT_GM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "game_modes").maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCfg({ ...DEFAULT_GM, ...(data.value as GMMap) });
        setLoading(false);
      });
  }, []);

  const update = (mode: keyof GMMap, field: keyof GMCfg, val: boolean) => {
    setCfg((c) => ({ ...c, [mode]: { ...c[mode], [field]: val } }));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "game_modes",
      value: cfg as any,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Game modes saved");
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>;

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <div className="font-bold">Game Mode Controls</div>
        </div>
        <div className="text-xs text-muted-foreground">
          Toggle each mode on/off and enable 2-player or 4-player options. Disabled modes are hidden from players.
        </div>
      </Card>

      {(Object.keys(cfg) as (keyof GMMap)[]).map((m) => (
        <Card key={m} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{MODE_LABELS[m]}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{cfg[m].enabled ? "On" : "Off"}</span>
              <Switch checked={cfg[m].enabled} onCheckedChange={(v) => update(m, "enabled", v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-lg border p-2">
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> 2 Players</Label>
              <Switch
                checked={cfg[m].p2}
                disabled={!cfg[m].enabled}
                onCheckedChange={(v) => update(m, "p2", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-2">
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> 4 Players</Label>
              <Switch
                checked={cfg[m].p4}
                disabled={!cfg[m].enabled}
                onCheckedChange={(v) => update(m, "p4", v)}
              />
            </div>
          </div>
        </Card>
      ))}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Game Modes"}
      </Button>
    </div>
  );
}

// ── Royal Steps Config ──────────────────────────────────────────
type RoyalCfg = {
  enabled: boolean;
  min_bet: number;
  max_bet: number;
  max_steps: number;
  base_multiplier: number;
  trap_chance: number; // 0..1 per step
};
const DEFAULT_ROYAL: RoyalCfg = {
  enabled: true,
  min_bet: 10,
  max_bet: 1000,
  max_steps: 10,
  base_multiplier: 1.15,
  trap_chance: 0.12,
};

function RoyalStepsTab() {
  const [cfg, setCfg] = useState<RoyalCfg>(DEFAULT_ROYAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "royal_steps").maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCfg({ ...DEFAULT_ROYAL, ...(data.value as Partial<RoyalCfg>) });
        setLoading(false);
      });
  }, []);

  const winPct = Math.round((1 - cfg.trap_chance) * 100);
  const setWinPct = (pct: number) => {
    const p = Math.max(1, Math.min(99, Math.round(pct)));
    setCfg((c) => ({ ...c, trap_chance: Number(((100 - p) / 100).toFixed(4)) }));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "royal_steps",
      value: cfg as any,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Royal Steps saved");
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>;

  // Estimate full-run win prob = (1 - trap)^max_steps
  const survive = Math.pow(1 - cfg.trap_chance, cfg.max_steps);
  const maxMult = Math.pow(cfg.base_multiplier, cfg.max_steps);

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <div className="font-bold">Royal Steps Game</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Enabled (show on Home)</Label>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Winner Chance (per step)</div>
        <div className="text-xs text-muted-foreground">
          Higher % = players win more often. Lower % = harder, more traps.
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={99}
            value={winPct}
            onChange={(e) => setWinPct(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            min={1}
            max={99}
            value={winPct}
            onChange={(e) => setWinPct(Number(e.target.value))}
            className="w-16 h-9 rounded-md border bg-background px-2 text-sm"
          />
          <span className="text-sm font-bold">%</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Trap chance per step: <span className="font-mono">{(cfg.trap_chance * 100).toFixed(1)}%</span>
          {" • "}Full clear odds: <span className="font-mono">{(survive * 100).toFixed(2)}%</span>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Multiplier & Steps</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Base multiplier / step</Label>
            <input
              type="number"
              step={0.01}
              min={1.01}
              max={5}
              value={cfg.base_multiplier}
              onChange={(e) => setCfg((c) => ({ ...c, base_multiplier: Math.max(1.01, Number(e.target.value) || 1.15) }))}
              className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Max steps</Label>
            <input
              type="number"
              min={3}
              max={30}
              value={cfg.max_steps}
              onChange={(e) => setCfg((c) => ({ ...c, max_steps: Math.max(3, Math.min(30, Math.floor(Number(e.target.value) || 10))) }))}
              className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            />
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Max payout multiplier: <span className="font-mono">×{maxMult.toFixed(2)}</span>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Bet Limits</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Min bet</Label>
            <input
              type="number"
              min={1}
              value={cfg.min_bet}
              onChange={(e) => setCfg((c) => ({ ...c, min_bet: Math.max(1, Number(e.target.value) || 1) }))}
              className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Max bet</Label>
            <input
              type="number"
              min={1}
              value={cfg.max_bet}
              onChange={(e) => setCfg((c) => ({ ...c, max_bet: Math.max(1, Number(e.target.value) || 1000) }))}
              className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            />
          </div>
        </div>
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Royal Steps"}
      </Button>
    </div>
  );
}


// ── Bot Matchmaking Config ────────────────────────────────────────
type BotPerMode = { delay: number; win_rate: number };
type BotConfig = {
  enabled: boolean;
  delay_seconds: number;
  win_rate: number;
  names: string[];
  avatars: string[];
  per_mode: Record<string, BotPerMode>;
};
const DEFAULT_BOT_CFG: BotConfig = {
  enabled: true,
  delay_seconds: 25,
  win_rate: 40,
  names: [],
  avatars: [],
  per_mode: {
    classic: { delay: 25, win_rate: 40 },
    speed: { delay: 15, win_rate: 45 },
    quick: { delay: 12, win_rate: 45 },
    time: { delay: 20, win_rate: 40 },
  },
};
const BOT_MODES: Array<{ key: string; label: string }> = [
  { key: "classic", label: "Classic" },
  { key: "speed", label: "Speed" },
  { key: "quick", label: "Quick" },
  { key: "time", label: "Time" },
];

function BotMatchConfig() {
  const [cfg, setCfg] = useState<BotConfig>(DEFAULT_BOT_CFG);
  const [namesText, setNamesText] = useState("");
  const [avatarsText, setAvatarsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "bot_config")
        .maybeSingle();
      if (data?.value) {
        const v = { ...DEFAULT_BOT_CFG, ...(data.value as any) };
        v.per_mode = { ...DEFAULT_BOT_CFG.per_mode, ...(v.per_mode || {}) };
        setCfg(v);
        setNamesText((v.names || []).join(", "));
        setAvatarsText((v.avatars || []).join("\n"));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const names = namesText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const avatars = avatarsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next: BotConfig = {
      ...cfg,
      delay_seconds: Math.max(5, Math.min(300, Number(cfg.delay_seconds) || 25)),
      win_rate: Math.max(0, Math.min(100, Number(cfg.win_rate) || 0)),
      names,
      avatars,
    };
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "bot_config", value: next as any });
    setSaving(false);
    if (error) return toast.error(error.message);
    setCfg(next);
    toast.success("Bot config saved");
  };

  if (loading) return <Card className="p-4 text-center text-sm">Loading…</Card>;

  return (
    <Card className="p-4 space-y-4 border-primary/30">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Bot Matchmaking</h3>
      </div>

      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
        <div>
          <p className="text-sm font-medium">Bot system</p>
          <p className="text-[10px] text-muted-foreground">Auto-fill queue with bots</p>
        </div>
        <Switch
          checked={cfg.enabled}
          onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Default delay (sec)</Label>
          <Input
            type="number"
            min={5}
            max={300}
            value={cfg.delay_seconds}
            onChange={(e) => setCfg({ ...cfg, delay_seconds: Number(e.target.value) })}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-[10px]">Default win rate %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={cfg.win_rate}
            onChange={(e) => setCfg({ ...cfg, win_rate: Number(e.target.value) })}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-semibold">Per-mode override</Label>
        {BOT_MODES.map((m) => {
          const pm = cfg.per_mode[m.key] ?? { delay: cfg.delay_seconds, win_rate: cfg.win_rate };
          return (
            <div key={m.key} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-end">
              <div className="text-xs font-medium pb-2">{m.label}</div>
              <div>
                <Label className="text-[10px]">Delay</Label>
                <Input
                  type="number"
                  min={5}
                  max={300}
                  value={pm.delay}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      per_mode: { ...cfg.per_mode, [m.key]: { ...pm, delay: Number(e.target.value) } },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Win %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={pm.win_rate}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      per_mode: { ...cfg.per_mode, [m.key]: { ...pm, win_rate: Number(e.target.value) } },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Label className="text-[10px]">Bot names (Bangladeshi, comma-separated)</Label>
        <Textarea
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          className="text-xs min-h-[80px]"
          placeholder="Rahim, Karim, Sakib, Tamim..."
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {namesText.split(/[,\n]/).filter((s) => s.trim()).length} names
        </p>
      </div>

      <div>
        <Label className="text-[10px]">Bot avatar URLs (one per line, optional)</Label>
        <Textarea
          value={avatarsText}
          onChange={(e) => setAvatarsText(e.target.value)}
          className="text-xs min-h-[60px]"
          placeholder="https://..."
        />
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save Bot Config"}
      </Button>
    </Card>
  );
}

// ── Analytics ──────────────────────────────────────────────
function AnalyticsTab() {
  const c = useCurrency();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - days + 1);
      since.setHours(0, 0, 0, 0);
      const sinceISO = since.toISOString();

      const [
        { data: deposits },
        { data: withdraws },
        { data: commission },
        { data: games },
        { data: newUsers },
        { count: totalUsers },
        { count: totalGames },
        { count: totalBots },
      ] = await Promise.all([
        supabase.from("transactions").select("amount, processed_at").eq("type", "deposit").eq("status", "approved").gte("processed_at", sinceISO),
        supabase.from("transactions").select("amount, processed_at").eq("type", "withdraw").eq("status", "approved").gte("processed_at", sinceISO),
        supabase.from("commission_ledger").select("commission_amount, created_at").gte("created_at", sinceISO),
        supabase.from("game_results").select("entry_fee, prize_awarded, created_at, mode").gte("created_at", sinceISO),
        supabase.from("profiles").select("created_at").eq("is_bot", false).gte("created_at", sinceISO),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_bot", false),
        supabase.from("game_results").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_bot", true),
      ]);

      // Build per-day series
      const series: Record<string, any> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const k = d.toISOString().slice(5, 10); // MM-DD
        series[k] = { day: k, deposits: 0, withdraws: 0, commission: 0, games: 0, users: 0 };
      }
      const bucket = (ts: string) => new Date(ts).toISOString().slice(5, 10);
      (deposits ?? []).forEach((r: any) => { const k = bucket(r.processed_at); if (series[k]) series[k].deposits += Number(r.amount); });
      (withdraws ?? []).forEach((r: any) => { const k = bucket(r.processed_at); if (series[k]) series[k].withdraws += Number(r.amount); });
      (commission ?? []).forEach((r: any) => { const k = bucket(r.created_at); if (series[k]) series[k].commission += Number(r.commission_amount); });
      (games ?? []).forEach((r: any) => { const k = bucket(r.created_at); if (series[k]) series[k].games += 1; });
      (newUsers ?? []).forEach((r: any) => { const k = bucket(r.created_at); if (series[k]) series[k].users += 1; });

      const chart = Object.values(series);
      const totalDep = (deposits ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const totalWd = (withdraws ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const totalComm = (commission ?? []).reduce((s, r: any) => s + Number(r.commission_amount), 0);
      const totalGamesPeriod = (games ?? []).length;
      const totalNewUsers = (newUsers ?? []).length;

      // Mode breakdown
      const modeMap: Record<string, number> = {};
      (games ?? []).forEach((g: any) => { modeMap[g.mode || "unknown"] = (modeMap[g.mode || "unknown"] ?? 0) + 1; });
      const modePie = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

      setData({
        chart, modePie,
        totals: { dep: totalDep, wd: totalWd, comm: totalComm, games: totalGamesPeriod, users: totalNewUsers },
        all: { users: totalUsers ?? 0, games: totalGames ?? 0, bots: totalBots ?? 0, net: totalDep - totalWd },
      });
      setLoading(false);
    })();
  }, [days]);

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading analytics…</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[7, 14, 30].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="flex-1 h-8 text-[11px]" onClick={() => setDays(d)}>
            Last {d}d
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Wallet className="h-4 w-4" />} label={`Deposits (${days}d)`} value={`${c}${data.totals.dep.toLocaleString()}`} />
        <StatCard icon={<Wallet className="h-4 w-4" />} label={`Withdraws (${days}d)`} value={`${c}${data.totals.wd.toLocaleString()}`} />
        <StatCard icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Commission" value={`${c}${data.totals.comm.toLocaleString()}`} highlight />
        <StatCard icon={<Gamepad2 className="h-4 w-4" />} label="Games Played" value={data.totals.games} />
        <StatCard icon={<Users className="h-4 w-4" />} label="New Users" value={data.totals.users} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Net Cash Flow" value={`${c}${data.all.net.toLocaleString()}`} />
      </div>

      <Card className="p-3">
        <div className="text-xs font-bold mb-2">Daily Revenue ({c})</div>
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Line type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} name="Deposits" />
              <Line type="monotone" dataKey="withdraws" stroke="#ef4444" strokeWidth={2} name="Withdraws" />
              <Line type="monotone" dataKey="commission" stroke="#eab308" strokeWidth={2} name="Commission" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-xs font-bold mb-2">Daily Activity</div>
        <div className="w-full h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="games" fill="#8338EC" name="Games" />
              <Bar dataKey="users" fill="#3A86FF" name="New Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {data.modePie.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-bold mb-2">Games by Mode</div>
          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.modePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={{ fontSize: 10 }}>
                  {data.modePie.map((_: any, i: number) => (
                    <Cell key={i} fill={["#00FF87", "#8338EC", "#3A86FF", "#D4FF00", "#FF3B5C"][i % 5]} />
                  ))}
                </Pie>
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-3">
        <div className="text-xs font-bold mb-2">All-Time Totals</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-lg font-bold">{data.all.users}</div><div className="text-[10px] text-muted-foreground">Users</div></div>
          <div><div className="text-lg font-bold">{data.all.games}</div><div className="text-[10px] text-muted-foreground">Games</div></div>
          <div><div className="text-lg font-bold">{data.all.bots}</div><div className="text-[10px] text-muted-foreground">Bots</div></div>
        </div>
      </Card>
    </div>
  );
}

// ── Fincra auto-deposit settings ──────────────────────────────────
function FincraSettingsTab() {
  const load = useServerFn(getFincraSettings);
  const save = useServerFn(saveFincraSettings);
  const [form, setForm] = useState({
    enabled: false,
    environment: "sandbox" as "sandbox" | "live",
    business_id: "",
    public_key: "",
    secret_key: "",
    currency: "NGN",
    webhook_secret: "",
    success_url: "",
  });
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load()
      .then((d) => {
        setForm({
          enabled: d.enabled,
          environment: d.environment,
          business_id: d.business_id,
          public_key: d.public_key,
          secret_key: d.secret_key,
          currency: d.currency || "NGN",
          webhook_secret: d.webhook_secret,
          success_url: d.success_url,
        });
        setHasSecret(d.has_secret);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Fincra settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/hooks/fincra`;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-sm">⚡ Fincra Auto Deposit</div>
          <div className="text-[11px] text-muted-foreground">
            Fincra hosted checkout (cards, bank transfer, mobile money)
          </div>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
      </div>

      <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-[11px] space-y-1">
        <div className="font-semibold text-blue-400">No Fincra account yet?</div>
        <div className="text-muted-foreground">
          Sign up at{" "}
          <a
            href="https://app.fincra.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            app.fincra.com
          </a>{" "}
          and grab your Business ID, Public Key, and Secret Key from Settings → API Keys & Webhooks.
        </div>
      </div>

      {(() => {
        const missing: string[] = [];
        if (!form.business_id.trim()) missing.push("Business ID");
        if (!form.secret_key.trim() && !hasSecret) missing.push("Secret Key");
        if (missing.length > 0) {
          return (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-[11px]">
              <div className="font-semibold text-yellow-500">⚠️ Missing required fields:</div>
              <div className="text-muted-foreground">{missing.join(", ")}</div>
            </div>
          );
        }
        return (
          <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-[11px]">
            <div className="font-semibold text-green-500">✓ Required fields filled</div>
          </div>
        );
      })()}

      <div>
        <Label className="text-[11px]">Environment</Label>
        <select
          className="w-full h-9 rounded-md border bg-background px-2 text-sm"
          value={form.environment}
          onChange={(e) =>
            setForm({ ...form, environment: e.target.value as "sandbox" | "live" })
          }
        >
          <option value="sandbox">Sandbox (Test)</option>
          <option value="live">Live (Production)</option>
        </select>
      </div>

      <div>
        <Label className="text-[11px]">Business ID</Label>
        <Input
          className="h-9"
          value={form.business_id}
          onChange={(e) => setForm({ ...form, business_id: e.target.value })}
          placeholder="e.g. 64abc123def4567890"
        />
      </div>

      <div>
        <Label className="text-[11px]">Public Key</Label>
        <Input
          className="h-9"
          value={form.public_key}
          onChange={(e) => setForm({ ...form, public_key: e.target.value })}
          placeholder="pk_test_… or pk_live_…"
        />
      </div>

      <div>
        <Label className="text-[11px]">Secret Key</Label>
        <Input
          className="h-9"
          type="password"
          value={form.secret_key}
          onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
          placeholder="•••••• (leave blank to keep current)"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Used as the <span className="font-mono">api-key</span> header. Also doubles as
          webhook signing secret unless you set one below.
        </p>
      </div>

      <div>
        <Label className="text-[11px]">Currency</Label>
        <Input
          className="h-9"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
          placeholder="NGN / KES / GHS / USD"
        />
      </div>

      <div>
        <Label className="text-[11px]">Success Redirect URL (optional)</Label>
        <Input
          className="h-9"
          value={form.success_url}
          onChange={(e) => setForm({ ...form, success_url: e.target.value })}
          placeholder="Leave blank — defaults to /wallet"
        />
      </div>

      <div>
        <Label className="text-[11px]">Webhook Signing Secret (optional)</Label>
        <Input
          className="h-9"
          type="password"
          value={form.webhook_secret}
          onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
          placeholder="Defaults to Secret Key"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Set only if you've configured a different webhook secret in Fincra.
        </p>
      </div>

      <div className="rounded-md bg-muted p-2 text-[10px] space-y-1">
        <div className="font-bold">Webhook URL (set in Fincra dashboard):</div>
        <div className="break-all font-mono">{webhookUrl}</div>
        <div className="text-muted-foreground">
          Fincra signs the body as HMAC-SHA512 in the <span className="font-mono">signature</span> header.
        </div>
      </div>

      <Button className="w-full" onClick={onSave} disabled={busy}>
        {busy ? "Saving…" : "Save Settings"}
      </Button>
    </Card>
  );
}


// ── Live Win Board admin config ───────────────────────────────────
type LiveBoardCfg = {
  enabled: boolean;
  win_rate_display: number;   // shown badge %
  win_chance: number;         // % of rows that are wins (0-100)
  online_min: number;
  online_max: number;
  paid_base: number;          // K units (e.g. 1850 -> N1850K)
  paid_growth: number;        // increment per tick
  games_min: number;
  games_max: number;
  win_multiplier: number;     // payout multiplier vs stake
  row_interval_ms: number;
  stakes: string;             // CSV numbers
  modes: string;              // CSV
  names: string;              // CSV
};

const DEFAULT_LIVE_BOARD: LiveBoardCfg = {
  enabled: true,
  win_rate_display: 70,
  win_chance: 70,
  online_min: 1240,
  online_max: 1320,
  paid_base: 1850,
  paid_growth: 0.137,
  games_min: 320,
  games_max: 360,
  win_multiplier: 1.9,
  row_interval_ms: 2200,
  stakes: "10,20,50,100,200,500,1000,2000",
  modes: "Classic,Speed,Quick,Time",
  names: "Rahim,Sakib,Tamim,Karim,Jamil,Nayeem,Riyad,Sabbir,Tanvir,Hasan,Imran,Rakib,Shihab,Mahin,Faysal,Rocky,Sohan,Arif,Niloy,Pavel,Mehedi,Jubayer,Rasel,Anik,Shawon,Tuhin,Robin,Sumon,Mizan,Polash,Joy,Akash,Sajid,Rifat,Limon,Shanto,Bappy,Fahim,Nahid,Sajib,Tonmoy,Dipto,Sourav,Pritom,Shuvo,Ratul,Jewel,Munna,Nabil,Ovi,Borsha,Mim,Tisha,Nila,Sumi,Lamia,Ria,Mitu,Jui,Tania",
};

function LiveBoardTab() {
  const [cfg, setCfg] = useState<LiveBoardCfg>(DEFAULT_LIVE_BOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "live_board").maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCfg({ ...DEFAULT_LIVE_BOARD, ...(data.value as Partial<LiveBoardCfg>) });
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "live_board",
      value: cfg as any,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Live Board saved");
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>;

  const num = (k: keyof LiveBoardCfg) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg({ ...cfg, [k]: Number(e.target.value) } as LiveBoardCfg);

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <div className="font-bold">Live Win Board (Home page)</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Show on Home</Label>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Header</div>
        <div>
          <Label className="text-xs">Win rate badge (%)</Label>
          <Input type="number" min={0} max={100} value={cfg.win_rate_display} onChange={num("win_rate_display")} />
        </div>
        <div>
          <Label className="text-xs">Win chance per row (%) — controls how many rows show as wins</Label>
          <Input type="number" min={0} max={100} value={cfg.win_chance} onChange={num("win_chance")} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Top counters</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Online min</Label>
            <Input type="number" value={cfg.online_min} onChange={num("online_min")} />
          </div>
          <div>
            <Label className="text-xs">Online max</Label>
            <Input type="number" value={cfg.online_max} onChange={num("online_max")} />
          </div>
          <div>
            <Label className="text-xs">Paid Today base (K)</Label>
            <Input type="number" value={cfg.paid_base} onChange={num("paid_base")} />
          </div>
          <div>
            <Label className="text-xs">Paid growth / tick</Label>
            <Input type="number" step="0.001" value={cfg.paid_growth} onChange={num("paid_growth")} />
          </div>
          <div>
            <Label className="text-xs">Live games min</Label>
            <Input type="number" value={cfg.games_min} onChange={num("games_min")} />
          </div>
          <div>
            <Label className="text-xs">Live games max</Label>
            <Input type="number" value={cfg.games_max} onChange={num("games_max")} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Row generator</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Win payout multiplier</Label>
            <Input type="number" step="0.1" value={cfg.win_multiplier} onChange={num("win_multiplier")} />
          </div>
          <div>
            <Label className="text-xs">New row every (ms)</Label>
            <Input type="number" value={cfg.row_interval_ms} onChange={num("row_interval_ms")} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Stakes (CSV)</Label>
          <Input value={cfg.stakes} onChange={(e) => setCfg({ ...cfg, stakes: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Modes (CSV)</Label>
          <Input value={cfg.modes} onChange={(e) => setCfg({ ...cfg, modes: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Names pool (CSV)</Label>
          <Textarea rows={5} value={cfg.names} onChange={(e) => setCfg({ ...cfg, names: e.target.value })} />
        </div>
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Live Board"}
      </Button>
    </div>
  );
}

// ── FX Casino settings ───────────────────────────────────────────
function FxCasinoTab() {
  const [cfg, setCfg] = useState({
    enabled: true,
    min_bet: 10,
    max_bet: 1000,
    win_chance: 0.45,
    payout_multiplier: 1.9,
    preset_stakes: "10,50,100,250,500,1000",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "fx_casino").maybeSingle()
      .then(({ data }) => {
        const v: any = data?.value || {};
        setCfg({
          enabled: v.enabled !== false,
          min_bet: Number(v.min_bet ?? 10),
          max_bet: Number(v.max_bet ?? 1000),
          win_chance: Number(v.win_chance ?? 0.45),
          payout_multiplier: Number(v.payout_multiplier ?? 1.9),
          preset_stakes: Array.isArray(v.preset_stakes) ? v.preset_stakes.join(",") : "10,50,100,250,500,1000",
        });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const stakes = cfg.preset_stakes
      .split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
    const payload = {
      enabled: cfg.enabled,
      min_bet: Number(cfg.min_bet),
      max_bet: Number(cfg.max_bet),
      win_chance: Math.max(0, Math.min(1, Number(cfg.win_chance))),
      payout_multiplier: Number(cfg.payout_multiplier),
      preset_stakes: stakes,
    };
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "fx_casino", value: payload }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("FX Casino settings saved");
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold">Enable FX Casino</Label>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          When off, the FX Casino card is hidden and the route shows a disabled message.
        </p>
      </Card>

      <Card className="p-3 grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Min Bet (৳)</Label>
          <Input type="number" value={cfg.min_bet} onChange={(e) => setCfg({ ...cfg, min_bet: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Max Bet (৳)</Label>
          <Input type="number" value={cfg.max_bet} onChange={(e) => setCfg({ ...cfg, max_bet: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Win Chance (0–1)</Label>
          <Input type="number" step="0.01" min="0" max="1" value={cfg.win_chance}
            onChange={(e) => setCfg({ ...cfg, win_chance: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground mt-1">e.g. 0.45 = 45% win rate</p>
        </div>
        <div>
          <Label className="text-xs">Payout Multiplier</Label>
          <Input type="number" step="0.05" value={cfg.payout_multiplier}
            onChange={(e) => setCfg({ ...cfg, payout_multiplier: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground mt-1">Win pays stake × this (e.g. 1.9)</p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Stake Presets (CSV)</Label>
          <Input value={cfg.preset_stakes}
            onChange={(e) => setCfg({ ...cfg, preset_stakes: e.target.value })} />
        </div>
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save FX Casino"}
      </Button>
    </div>
  );
}
