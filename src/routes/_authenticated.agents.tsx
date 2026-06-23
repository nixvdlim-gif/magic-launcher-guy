import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MessageCircle, MapPin, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const { lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 pt-6 pb-20 space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/wallet"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <UserCheck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{lang === "bn" ? "ক্যাশ এজেন্ট" : "Cash Agents"}</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        {lang === "bn"
          ? "যেকোনো এজেন্টের সাথে যোগাযোগ করে দ্রুত রিচার্জ / উইথড্র করুন।"
          : "Contact any agent for fast recharge / withdraw."}
      </p>

      {loading && <p className="text-center text-sm text-muted-foreground py-6">…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          {lang === "bn" ? "কোনো এজেন্ট নেই" : "No agents available"}
        </p>
      )}

      {rows.map((a) => (
        <Card key={a.id} className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold">{a.name}</div>
              {a.area && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {a.area}
                </div>
              )}
            </div>
          </div>
          {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
          <div className="flex gap-2 pt-1">
            {a.phone && (
              <Button asChild size="sm" variant="outline" className="flex-1">
                <a href={`tel:${a.phone}`}><Phone className="h-4 w-4 mr-1" /> {a.phone}</a>
              </Button>
            )}
            {a.whatsapp && (
              <Button asChild size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                <a href={`https://wa.me/${a.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}