import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/hooks/cleanup-rooms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require shared secret (configured by admin in app_settings.security.cron_secret) to prevent abuse
        const { data: row } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "security")
          .maybeSingle();
        const expected = ((row?.value as any)?.cron_secret as string | undefined) ?? "";
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (
          !expected ||
          provided.length !== expected.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const now = new Date();
        const waitingCutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
        const playingCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

        // Cancel stale waiting rooms
        const { data: staleWait } = await supabaseAdmin
          .from("game_rooms")
          .select("id")
          .eq("status", "waiting")
          .lt("created_at", waitingCutoff);

        // Cancel stale playing rooms (no end, started long ago)
        const { data: stalePlay } = await supabaseAdmin
          .from("game_rooms")
          .select("id")
          .eq("status", "playing")
          .lt("updated_at", playingCutoff);

        const ids = [...(staleWait ?? []), ...(stalePlay ?? [])].map((r: any) => r.id);
        if (ids.length > 0) {
          await supabaseAdmin
            .from("game_rooms")
            .update({ status: "cancelled", ended_at: now.toISOString() })
            .in("id", ids);
          await supabaseAdmin.from("game_room_players").delete().in("room_id", ids);
        }

        return new Response(
          JSON.stringify({ cleaned: ids.length }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});