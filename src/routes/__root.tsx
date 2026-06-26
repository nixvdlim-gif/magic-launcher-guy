import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // Auto-recover from stale chunk errors after a deploy: browsers cache the
  // old route chunk hash; loading the new build returns 404. Hard-reload once
  // to fetch the fresh chunk before showing the error UI.
  useEffect(() => {
    const msg = String(error?.message ?? "");
    const isChunkErr =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /ChunkLoadError/i.test(msg) ||
      /Loading chunk \d+ failed/i.test(msg);
    if (!isChunkErr) return;
    if (typeof window === "undefined") return;
    const KEY = "lt_chunk_reload_at";
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 10_000) return; // avoid reload loop
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ChaleBid - Play, Win, Earn" },
      { name: "description", content: "ChaleBid - multiplayer Ludo gaming. Play, win, and withdraw." },
      { name: "author", content: "ChaleBid" },
      { property: "og:title", content: "ChaleBid - Play, Win, Earn" },
      { property: "og:description", content: "ChaleBid - multiplayer Ludo gaming. Play, win, and withdraw." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "theme-color", content: "#0a0a0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "ChaleBid" },
      { name: "twitter:title", content: "ChaleBid - Play, Win, Earn" },
      { name: "twitter:description", content: "ChaleBid - multiplayer Ludo gaming. Play, win, and withdraw." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4a420a89-3e8f-45ee-b87a-d3df21e3d391/id-preview-6bb47def--609c12a2-31b5-4856-9896-5aa311147d37.lovable.app-1778859937084.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4a420a89-3e8f-45ee-b87a-d3df21e3d391/id-preview-6bb47def--609c12a2-31b5-4856-9896-5aa311147d37.lovable.app-1778859937084.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <CurrencyProvider>
          <AuthProvider>
            <AuthSync />
            <PushNotificationsMount />
            <ThemeLoader />
            <ServiceWorkerMount />
            <Outlet />
            <Toaster theme="dark" position="top-center" />
          </AuthProvider>
        </CurrencyProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function PushNotificationsMount() {
  usePushNotifications();
  return null;
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function ThemeLoader() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "theme")
        .maybeSingle();
      const theme = data?.value as Record<string, string> | undefined;
      if (!theme) return;
      const root = document.documentElement;
      Object.entries(theme).forEach(([k, v]) => {
        if (typeof v === "string") root.style.setProperty(`--${k.replace(/_/g, "-")}`, v);
      });
    })();
  }, []);
  return null;
}

function ServiceWorkerMount() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((registration) => registration.unregister());
      });
    }
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
  }, []);
  return null;
}
