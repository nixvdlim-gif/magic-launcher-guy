import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PERMISSION_KEY = "ludo_push_permission_asked";

/**
 * In-tab web push: subscribes to realtime inserts on `notifications` for the
 * signed-in user. Each new row triggers a sonner toast plus, when the browser
 * grants permission, a native Notification popup that surfaces even when the
 * tab is in the background.
 */
export function usePushNotifications() {
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unmounted = false;

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || unmounted) return;
      userIdRef.current = uid;

      // Ask for browser notification permission once per device
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default" &&
        !localStorage.getItem(PERMISSION_KEY)
      ) {
        try {
          await Notification.requestPermission();
        } catch {
          /* ignore */
        }
        localStorage.setItem(PERMISSION_KEY, "1");
      }

      const ch = supabase.channel(
        `push:notifications:${uid}:${Math.random().toString(36).slice(2, 10)}`,
      );
      ch.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          ({ new: row }: any) => {
            const title = row?.title ?? "Notification";
            const body = row?.body ?? "";

            toast(title, { description: body });

            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted" &&
              document.visibilityState !== "visible"
            ) {
              try {
                const n = new Notification(title, {
                  body,
                  icon: "/favicon.ico",
                  tag: row?.id,
                });
                if (row?.link) {
                  n.onclick = () => {
                    window.focus();
                    window.location.href = row.link;
                  };
                }
              } catch {
                /* ignore */
              }
            }
          },
        );
      ch.subscribe();
      channel = ch;
    };

    setup();

    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id !== userIdRef.current) {
        if (channel) supabase.removeChannel(channel);
        channel = null;
        setup();
      }
    });

    return () => {
      unmounted = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
}