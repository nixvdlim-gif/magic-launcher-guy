import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function TournamentCountdown({
  startAt,
  status,
  className = "",
}: {
  startAt: string;
  status?: string;
  className?: string;
}) {
  const { lang } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(startAt).getTime() - now;

  if (status && status !== "upcoming") {
    const labels: Record<string, { bn: string; en: string; cls: string }> = {
      live: { bn: "🔴 চলছে", en: "🔴 LIVE", cls: "text-red-500 animate-pulse" },
      finished: { bn: "শেষ", en: "Finished", cls: "text-muted-foreground" },
      cancelled: { bn: "বাতিল", en: "Cancelled", cls: "text-muted-foreground" },
    };
    const l = labels[status];
    if (l) {
      return (
        <div className={`text-[11px] font-bold ${l.cls} ${className}`}>
          {lang === "bn" ? l.bn : l.en}
        </div>
      );
    }
  }

  if (diff <= 0) {
    return (
      <div className={`text-[11px] font-bold text-red-500 animate-pulse flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3" /> {lang === "bn" ? "শুরু হচ্ছে…" : "Starting…"}
      </div>
    );
  }

  const sec = Math.floor(diff / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const urgent = sec <= 60;
  const soon = sec <= 600;

  return (
    <div
      className={`flex items-center gap-1 text-[11px] font-mono font-bold ${
        urgent ? "text-red-500 animate-pulse" : soon ? "text-yellow-500" : "text-primary"
      } ${className}`}
    >
      <Clock className="h-3 w-3" />
      {d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </div>
  );
}