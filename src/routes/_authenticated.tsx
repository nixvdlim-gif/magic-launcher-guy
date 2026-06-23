import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { LudoDiceBackground } from "@/components/LudoDiceBackground";
import { MonsterGhostBackground } from "@/components/MonsterGhostBackground";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  // Claim pending referral once after signup
  useEffect(() => {
    const claim = async () => {
      const refCode = typeof window !== "undefined" ? localStorage.getItem("pending_ref") : null;
      if (!refCode) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: me } = await supabase.from("profiles").select("id, referred_by").eq("id", u.user.id).maybeSingle();
      if (!me || me.referred_by) { localStorage.removeItem("pending_ref"); return; }
      const { data: ref } = await supabase.from("profiles").select("id").eq("game_id", refCode).maybeSingle();
      if (ref && ref.id !== u.user.id) {
        await supabase.from("profiles").update({ referred_by: ref.id }).eq("id", u.user.id);
      }
      localStorage.removeItem("pending_ref");
    };
    claim();
  }, []);
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[480px] sm:max-w-[420px] min-h-screen pb-20 relative overflow-hidden">
        <LudoDiceBackground />
        <MonsterGhostBackground />
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}