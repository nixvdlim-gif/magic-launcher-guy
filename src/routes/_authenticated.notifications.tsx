import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Bell, CheckCheck, ArrowDownToLine, ArrowUpFromLine, Send, Gift, Megaphone, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const ICONS: Record<string, any> = {
  deposit_approved: ArrowDownToLine,
  deposit_rejected: ArrowDownToLine,
  withdraw_approved: ArrowUpFromLine,
  withdraw_rejected: ArrowUpFromLine,
  transfer_received: Send,
  referral_bonus: Gift,
  announcement: Megaphone,
  system: Info,
};

function NotificationsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    if (error) return toast.error(error.message);
    load();
  };

  const open = async (n: any) => {
    if (!n.is_read) await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    if (n.link) nav({ to: n.link });
    else load();
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="px-5 pt-6 pb-8 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/home" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold flex-1">{lang === "bn" ? "নোটিফিকেশন" : "Notifications"}</h1>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> {lang === "bn" ? "সব পঠিত" : "Read all"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">{lang === "bn" ? "কোনো নোটিফিকেশন নেই" : "No notifications yet"}</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Info;
            const isRejected = n.type.endsWith("_rejected");
            return (
              <button key={n.id} onClick={() => open(n)} className="w-full text-left">
                <Card className={`p-3 flex items-start gap-3 ${!n.is_read ? "border-primary/40 bg-primary/5" : ""}`}>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isRejected ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate">{n.title}</div>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    {n.body && <div className="text-xs text-muted-foreground truncate">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
