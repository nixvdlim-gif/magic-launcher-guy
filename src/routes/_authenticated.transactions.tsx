import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type TxnType =
  | "deposit" | "withdraw" | "game_entry" | "game_win"
  | "refund" | "referral_bonus" | "admin_adjust" | "transfer_in" | "transfer_out";

type Txn = {
  id: string;
  type: TxnType;
  method: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  external_txn_id: string | null;
  reference: string | null;
  admin_note: string | null;
  created_at: string;
};

const FILTERS: { key: "all" | TxnType; label: DictKey }[] = [
  { key: "all", label: "all" },
  { key: "deposit", label: "type_deposit" },
  { key: "withdraw", label: "type_withdraw" },
  { key: "transfer_in", label: "type_transfer_in" },
  { key: "transfer_out", label: "type_transfer_out" },
  { key: "game_entry", label: "type_game_entry" },
  { key: "game_win", label: "type_game_win" },
  { key: "referral_bonus", label: "type_referral_bonus" },
];

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "completed" | "cancelled";
const STATUS_FILTERS: { key: StatusFilter; label: string; labelBn: string }[] = [
  { key: "all", label: "All", labelBn: "সব" },
  { key: "pending", label: "Pending", labelBn: "অপেক্ষমান" },
  { key: "approved", label: "Approved", labelBn: "অনুমোদিত" },
  { key: "completed", label: "Completed", labelBn: "সম্পন্ন" },
  { key: "rejected", label: "Rejected", labelBn: "বাতিল" },
  { key: "cancelled", label: "Cancelled", labelBn: "ক্যানসেলড" },
];

function TransactionsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const c = useCurrency();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [filter, setFilter] = useState<"all" | TxnType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refundFor, setRefundFor] = useState<Txn | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundedIds, setRefundedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("transactions")
      .select("id,type,method,amount,status,external_txn_id,reference,admin_note,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (filter !== "all") q = q.eq("type", filter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      q = q.lte("created_at", to.toISOString());
    }
    q.then(({ data }) => {
      if (data) setTxns(data as Txn[]);
      setLoading(false);
    });
  }, [user, filter, statusFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    const credit = ["deposit", "game_win", "refund", "referral_bonus", "transfer_in"];
    let inAmt = 0, outAmt = 0;
    for (const tx of txns) {
      if (tx.status === "rejected" || tx.status === "cancelled") continue;
      if (credit.includes(tx.type)) inAmt += Number(tx.amount);
      else outAmt += Number(tx.amount);
    }
    return { inAmt, outAmt };
  }, [txns]);

  const exportCSV = () => {
    if (txns.length === 0) {
      toast.error(lang === "bn" ? "এক্সপোর্টের জন্য কিছু নেই" : "Nothing to export");
      return;
    }
    const headers = ["Date", "Type", "Method", "Amount", "Status", "Txn ID", "Reference", "Note"];
    const rows = txns.map((tx) => [
      new Date(tx.created_at).toISOString(),
      tx.type,
      tx.method,
      String(tx.amount),
      tx.status,
      tx.external_txn_id ?? "",
      tx.reference ?? "",
      (tx.admin_note ?? "").replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(lang === "bn" ? "এক্সপোর্ট সফল" : "Exported");
  };

  const clearFilters = () => {
    setFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  const activeFilterCount =
    (filter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  const grouped = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const tx of txns) {
      const day = new Date(tx.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric", year: "numeric" });
      const arr = map.get(day) || [];
      arr.push(tx);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [txns, lang]);

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/wallet" className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="text-xl font-bold flex-1">{t("transactions")}</h1>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="relative h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center"
          aria-label="Filters"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={exportCSV}
          className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center"
          aria-label="Export CSV"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Summary chips */}
      {!loading && txns.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
              {lang === "bn" ? "ক্রেডিট" : "Credit"}
            </div>
            <div className="text-base font-bold text-primary">+{c}{totals.inAmt.toFixed(2)}</div>
          </div>
          <div className="rounded-xl bg-accent/10 border border-accent/20 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
              {lang === "bn" ? "ডেবিট" : "Debit"}
            </div>
            <div className="text-base font-bold text-accent">-{c}{totals.outAmt.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Expanded filters panel */}
      {showFilters && (
        <div className="rounded-2xl bg-card border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold">{lang === "bn" ? "ফিল্টার" : "Filters"}</div>
            <button
              onClick={clearFilters}
              className="text-[11px] text-muted-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              {lang === "bn" ? "মুছুন" : "Clear"}
            </button>
          </div>

          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1.5">
              {lang === "bn" ? "স্ট্যাটাস" : "Status"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    statusFilter === s.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  {lang === "bn" ? s.labelBn : s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">
                {lang === "bn" ? "থেকে" : "From"}
              </div>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">
                {lang === "bn" ? "পর্যন্ত" : "To"}
              </div>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          <Button onClick={exportCSV} variant="outline" size="sm" className="w-full">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {lang === "bn" ? "CSV ডাউনলোড" : "Download CSV"}
          </Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t("loading")}</p>
      ) : txns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-muted-foreground">{t("no_transactions")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{day}</div>
              <div className="rounded-2xl bg-card border border-border divide-y divide-border">
                {items.map((tx) => {
                  const isCredit = ["deposit", "game_win", "refund", "referral_bonus", "transfer_in"].includes(tx.type);
                  const typeKey = ("type_" + tx.type) as DictKey;
                  return (
                    <div key={tx.id} className="p-3 flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isCredit ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent"}`}>
                        {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t(typeKey)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {tx.method.toUpperCase()}{tx.external_txn_id ? ` · ${tx.external_txn_id}` : ""}
                        </div>
                        {tx.admin_note && tx.status === "rejected" && (
                          <div className="text-[11px] text-destructive mt-0.5">⚠ {tx.admin_note}</div>
                        )}
                        {(tx.type === "deposit" || tx.type === "withdraw") &&
                          (tx.status === "pending" || tx.status === "approved" || tx.status === "completed") &&
                          !refundedIds.has(tx.id) && (
                          <button
                            onClick={() => { setRefundFor(tx); setRefundReason(""); }}
                            className="text-[11px] text-accent underline mt-1"
                          >
                            {lang === "bn" ? "রিফান্ড চাই" : "Request refund"}
                          </button>
                        )}
                        {refundedIds.has(tx.id) && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">✓ {lang === "bn" ? "রিফান্ড রিকোয়েস্ট পাঠানো হয়েছে" : "Refund request sent"}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${isCredit ? "text-primary" : "text-foreground"}`}>{isCredit ? "+" : "-"}{c}{Number(tx.amount).toFixed(2)}</div>
                        <div className={`text-[10px] inline-block px-1.5 py-0.5 rounded mt-0.5 ${
                          tx.status === "approved" || tx.status === "completed" ? "bg-primary/15 text-primary"
                          : tx.status === "rejected" || tx.status === "cancelled" ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground"
                        }`}>{t(tx.status as DictKey)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {refundFor && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => !refundSubmitting && setRefundFor(null)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{lang === "bn" ? "রিফান্ড রিকোয়েস্ট" : "Refund request"}</h3>
              <button onClick={() => setRefundFor(null)} disabled={refundSubmitting}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              {refundFor.type === "deposit" ? (lang === "bn" ? "ডিপোজিট" : "Deposit") : (lang === "bn" ? "উইথড্র" : "Withdraw")} · {c}{Number(refundFor.amount).toFixed(2)} · {refundFor.method.toUpperCase()}
              {refundFor.external_txn_id ? ` · ${refundFor.external_txn_id}` : ""}
            </div>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value.slice(0, 500))}
              placeholder={lang === "bn" ? "রিফান্ডের কারণ লিখুন (কমপক্ষে ১০ অক্ষর)" : "Reason for refund (at least 10 characters)"}
              rows={4}
              className="w-full text-sm rounded-xl border border-border bg-background p-2"
            />
            <div className="text-[10px] text-muted-foreground text-right">{refundReason.length}/500</div>
            <Button
              className="w-full"
              disabled={refundSubmitting || refundReason.trim().length < 10}
              onClick={async () => {
                if (!user || !refundFor) return;
                setRefundSubmitting(true);
                try {
                  const subject = `Refund request: ${refundFor.type} ${c}${Number(refundFor.amount).toFixed(2)}`;
                  const { data: ticket, error: tErr } = await supabase
                    .from("support_tickets")
                    .insert({ user_id: user.id, subject, category: "refund", status: "open" })
                    .select("id")
                    .single();
                  if (tErr || !ticket) throw tErr;
                  const body = [
                    `Transaction ID: ${refundFor.id}`,
                    `Type: ${refundFor.type}`,
                    `Method: ${refundFor.method}`,
                    `Amount: ${c}${Number(refundFor.amount).toFixed(2)}`,
                    refundFor.external_txn_id ? `External Txn: ${refundFor.external_txn_id}` : null,
                    `Status: ${refundFor.status}`,
                    "",
                    `Reason: ${refundReason.trim()}`,
                  ].filter(Boolean).join("\n");
                  const { error: mErr } = await supabase
                    .from("support_messages")
                    .insert({ ticket_id: ticket.id, sender_id: user.id, is_admin: false, body });
                  if (mErr) throw mErr;
                  setRefundedIds((prev) => new Set(prev).add(refundFor.id));
                  toast.success(lang === "bn" ? "রিফান্ড রিকোয়েস্ট পাঠানো হয়েছে" : "Refund request sent");
                  setRefundFor(null);
                  setRefundReason("");
                } catch (e: any) {
                  toast.error(e?.message || (lang === "bn" ? "পাঠানো যায়নি" : "Failed to send"));
                } finally {
                  setRefundSubmitting(false);
                }
              }}
            >
              {refundSubmitting ? (lang === "bn" ? "পাঠানো হচ্ছে..." : "Sending...") : (lang === "bn" ? "রিকোয়েস্ট পাঠান" : "Send request")}
            </Button>
            <Link
              to="/support"
              className="block text-center text-xs text-muted-foreground underline"
            >
              {lang === "bn" ? "আমার সব টিকেট দেখুন" : "View all my tickets"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}