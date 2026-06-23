import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MessageCircle, Plus, Send, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

const CATEGORIES = [
  { id: "deposit", bn: "ডিপোজিট", en: "Deposit" },
  { id: "withdraw", bn: "উইথড্র", en: "Withdraw" },
  { id: "game", bn: "গেম", en: "Game" },
  { id: "account", bn: "অ্যাকাউন্ট", en: "Account" },
  { id: "general", bn: "সাধারণ", en: "General" },
];

const FAQS = [
  { q_bn: "কত সময়ে ডিপোজিট approve হয়?", q_en: "How long does deposit approval take?", a_bn: "সাধারণত ৫–১৫ মিনিট।", a_en: "Usually 5–15 minutes." },
  { q_bn: "উইথড্র মিনিমাম কত?", q_en: "What's the minimum withdraw?", a_bn: "১০০ টাকা।", a_en: "৳100." },
  { q_bn: "রেফারেল কমিশন কত?", q_en: "What's the referral commission?", a_bn: "L1: 5%, L2: 2%, L3: 1%", a_en: "L1: 5%, L2: 2%, L3: 1%" },
  { q_bn: "ট্রান্সফার ফি কত?", q_en: "What's the transfer fee?", a_bn: "৫% (admin সেট করতে পারে)।", a_en: "5% (admin configurable)." },
];

function SupportPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", user.id).order("last_message_at", { ascending: false });
    setTickets(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  if (open) return <TicketDetail ticket={open} onBack={() => { setOpen(null); load(); }} />;
  if (creating) return <NewTicket onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />;

  return (
    <div className="px-5 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/profile" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{lang === "bn" ? "সাপোর্ট" : "Support"}</h1>
      </div>

      <Button className="w-full" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {lang === "bn" ? "নতুন টিকেট" : "New Ticket"}
      </Button>

      {/* FAQ */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-primary" />
          {lang === "bn" ? "সাধারণ প্রশ্ন" : "FAQ"}
        </div>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <details key={i} className="group">
              <summary className="text-xs font-medium cursor-pointer py-1 list-none flex items-center justify-between">
                <span>{lang === "bn" ? f.q_bn : f.q_en}</span>
                <span className="text-muted-foreground group-open:rotate-180 transition">⌄</span>
              </summary>
              <div className="text-xs text-muted-foreground pl-2 pb-1">{lang === "bn" ? f.a_bn : f.a_en}</div>
            </details>
          ))}
        </div>
      </Card>

      <div>
        <div className="text-sm font-semibold mb-2">{lang === "bn" ? "আমার টিকেট" : "My Tickets"}</div>
        {tickets.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {lang === "bn" ? "কোনো টিকেট নেই" : "No tickets yet"}
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left">
                <Card className="p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{t.subject}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.category} · {new Date(t.last_message_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={t.status === "open" ? "default" : t.status === "resolved" ? "outline" : "secondary"} className="text-[10px]">
                    {t.status}
                  </Badge>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewTicket({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (subject.trim().length < 3 || body.trim().length < 5) {
      return toast.error(lang === "bn" ? "আরো বিস্তারিত লিখুন" : "Please add more detail");
    }
    setBusy(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: subject.trim(), category })
      .select()
      .single();
    if (error || !ticket) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
    await supabase.from("support_messages").insert({ ticket_id: ticket.id, sender_id: user.id, is_admin: false, body: body.trim() });
    setBusy(false);
    toast.success(lang === "bn" ? "টিকেট তৈরি হয়েছে" : "Ticket created");
    onCreated();
  };

  return (
    <div className="px-5 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1 -ml-1"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">{lang === "bn" ? "নতুন টিকেট" : "New Ticket"}</h1>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label className="text-xs">{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`text-xs py-1.5 rounded-md border ${category === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
              >
                {lang === "bn" ? c.bn : c.en}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">{lang === "bn" ? "বিষয়" : "Subject"}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required />
        </div>
        <div>
          <Label className="text-xs">{lang === "bn" ? "বিস্তারিত" : "Message"}</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : (lang === "bn" ? "জমা দিন" : "Submit")}
        </Button>
      </form>
    </div>
  );
}

function TicketDetail({ ticket, onBack }: { ticket: any; onBack: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at");
    setMsgs(data ?? []);
  };
  useEffect(() => { load(); }, [ticket.id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || reply.trim().length === 0) return;
    setBusy(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id, sender_id: user.id, is_admin: false, body: reply.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setReply("");
    load();
  };

  return (
    <div className="flex flex-col min-h-svh">
      <div className="px-5 pt-6 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{ticket.subject}</div>
            <div className="text-[11px] text-muted-foreground">{ticket.category} · {ticket.status}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.is_admin ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
              <div>{m.body}</div>
              <div className={`text-[9px] mt-1 ${m.is_admin ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <form onSubmit={send} className="p-3 border-t border-border flex gap-2">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={lang === "bn" ? "উত্তর লিখুন…" : "Type a reply…"} />
          <Button type="submit" disabled={busy || !reply.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
