import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MessageCircle, Send, Pin, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Msg = {
  id: string; user_id: string; body: string;
  is_pinned: boolean; is_system: boolean; is_deleted: boolean;
  created_at: string;
  profile?: { username: string; avatar_url: string | null; level: number } | null;
};

function ChatPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { isAdmin } = useRoles();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const enrich = async (rows: any[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (!ids.length) return rows;
    const { data: profs } = await supabase
      .from("profiles").select("id, username, avatar_url, level").in("id", ids);
    const map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    return rows.map((r) => ({ ...r, profile: map[r.user_id] ?? null }));
  };

  const loadInitial = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(80);
    const enriched = await enrich((data ?? []).reverse());
    setMsgs(enriched as Msg[]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    loadInitial();
    const ch = supabase
      .channel("global-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const row = payload.new as any;
        if (row.is_deleted) return;
        const [enriched] = await enrich([row]);
        setMsgs((prev) => [...prev, enriched as Msg]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: "smooth" }), 30);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const row = payload.new as any;
        setMsgs((prev) => prev.map((m) => m.id === row.id ? { ...m, ...row } : m).filter((m) => !m.is_deleted));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("send_chat_message", { _body: text });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const adminPin = async (m: Msg) => {
    // unpin all others first, then pin this one
    await supabase.from("chat_messages").update({ is_pinned: false }).eq("is_pinned", true);
    await supabase.from("chat_messages").update({ is_pinned: true }).eq("id", m.id);
    loadInitial();
  };
  const adminDelete = async (m: Msg) => {
    await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", m.id);
    setMsgs((prev) => prev.filter((x) => x.id !== m.id));
  };

  const pinned = msgs.find((m) => m.is_pinned);

  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/home"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <MessageCircle className="h-5 w-5 text-primary" />
        <h1 className="text-base font-bold flex-1">{lang === "bn" ? "কমিউনিটি চ্যাট" : "Community Chat"}</h1>
        <Button variant="ghost" size="icon" asChild title="Emoji shop">
          <Link to="/emoji-shop"><ShoppingBag className="h-5 w-5" /></Link>
        </Button>
      </div>

      {pinned && (
        <Card className="mx-3 mt-2 p-2.5 border-yellow-500/40 bg-yellow-500/10 flex items-start gap-2">
          <Pin className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-yellow-600 uppercase">{lang === "bn" ? "পিন করা" : "Pinned"}</div>
            <div className="text-sm">{pinned.body}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">— {pinned.profile?.username ?? "system"}</div>
          </div>
        </Card>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {msgs.filter((m) => !m.is_pinned).map((m) => {
          const own = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${own ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                {m.profile?.avatar_url
                  ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (m.profile?.username?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div className={`max-w-[78%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                <div className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
                  <span className="font-medium text-foreground/80">{m.profile?.username ?? "Player"}</span>
                  <span className="text-[9px] bg-secondary/60 rounded px-1">L{m.profile?.level ?? 1}</span>
                  <span>· {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className={`px-3 py-1.5 rounded-2xl text-sm break-words ${
                  own ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : m.is_system ? "bg-yellow-500/15 border border-yellow-500/40"
                      : "bg-secondary rounded-tl-sm"
                }`}>
                  {m.body}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 mt-1 px-1">
                    <button onClick={() => adminPin(m)} className="text-[10px] text-muted-foreground hover:text-yellow-500 flex items-center gap-0.5">
                      <Pin className="h-2.5 w-2.5" /> pin
                    </button>
                    <button onClick={() => adminDelete(m)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5">
                      <Trash2 className="h-2.5 w-2.5" /> del
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-12">
            {lang === "bn" ? "প্রথম মেসেজ আপনিই পাঠান!" : "Be the first to say hi!"}
          </p>
        )}
      </div>

      <div className="p-2 border-t bg-background flex gap-2 sticky bottom-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={lang === "bn" ? "মেসেজ লিখুন…" : "Type a message…"}
          maxLength={300}
        />
        <Button size="icon" onClick={send} disabled={!text.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}