import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, Gamepad2, Trophy, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/wallet", icon: Wallet, label: t("wallet") },
    { to: "/games", icon: Gamepad2, label: t("games") },
    { to: "/leaderboard", icon: Trophy, label: t("leaderboard") },
    { to: "/profile", icon: User, label: t("profile") },
  ] as const;
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[420px] border-t border-primary/25 z-50 backdrop-blur-xl"
      style={{ background: "oklch(0.12 0.05 285 / 0.96)" }}
    >
      <div className="grid grid-cols-5 h-16">
        {items.map(({ to, icon: Icon, label }) => {
          const active = path === to;
          return (
            <Link key={to} to={to} className="flex flex-col items-center justify-center gap-1">
              <Icon className={`h-5 w-5 transition ${active ? "text-primary drop-shadow-[0_0_8px_oklch(0.88_0.27_155/0.8)]" : "text-muted-foreground"}`} />
              <span className={`text-[10px] ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}