import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/ludo-coins-logo.png";

export function AuthShell({
  title,
  subtitle,
  children,
  back = "/",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: string;
}) {
  const { lang, setLang } = useI18n();
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen relative px-6 py-6 flex flex-col">
        <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <Link
            to={back}
            className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary border border-border"
          >
            {lang === "bn" ? "EN" : "বাংলা"}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 relative z-10">
          <img
            src={logo}
            alt="ChaleBid"
            className="h-12 w-12 object-contain rounded-2xl shadow-glow"
          />
          <div>
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="mt-8 relative z-10 flex-1 animate-float-up">{children}</div>
      </div>
    </div>
  );
}