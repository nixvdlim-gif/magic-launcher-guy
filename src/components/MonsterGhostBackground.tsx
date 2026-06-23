import React from "react";

/**
 * Low-opacity floating monster ghosts rendered behind page content.
 * Pure CSS animation — no JS overhead. Ghosts come in 3 silhouette
 * variants and drift across the screen on the existing dice keyframes.
 */
function Ghost({ variant }: { variant: 1 | 2 | 3 }) {
  // Shared body shape — classic ghost silhouette with wavy bottom
  const body = (
    <path
      d="M32 4c-12 0-22 10-22 22v32c0 2 2 3 4 2l5-3c1-1 3-1 4 0l5 3c1 1 3 1 4 0l5-3c1-1 3-1 4 0l5 3c2 1 4 0 4-2V26C54 14 44 4 32 4z"
      fill="currentColor"
      opacity="0.85"
    />
  );
  if (variant === 1) {
    // Wide-eyed monster with fangs
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        {body}
        <circle cx="24" cy="28" r="5" fill="#0b0b0b" />
        <circle cx="40" cy="28" r="5" fill="#0b0b0b" />
        <circle cx="25" cy="27" r="1.6" fill="#fff" />
        <circle cx="41" cy="27" r="1.6" fill="#fff" />
        <path d="M24 40h16l-3 6h-2l-2-3-2 3h-2l-2-3-3 3z" fill="#0b0b0b" />
      </svg>
    );
  }
  if (variant === 2) {
    // Sleepy/sneaky monster with crescent eyes
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        {body}
        <path d="M19 28c2 3 8 3 10 0" stroke="#0b0b0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M35 28c2 3 8 3 10 0" stroke="#0b0b0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="32" cy="40" rx="6" ry="3" fill="#0b0b0b" />
      </svg>
    );
  }
  // variant 3 — angry one-horn beast
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <path d="M32 -2l5 10h-10z" fill="currentColor" opacity="0.85" />
      {body}
      <path d="M19 26l8 4-8 4z" fill="#0b0b0b" />
      <path d="M45 26l-8 4 8 4z" fill="#0b0b0b" />
      <path d="M22 42c4-4 16-4 20 0l-3 4-2-2-3 3-2-3-3 3-2-3-2 2z" fill="#0b0b0b" />
    </svg>
  );
}

const PIECES: Array<{
  top: string;
  left: string;
  size: number;
  variant: 1 | 2 | 3;
  color: string;
  anim: string;
  delay: string;
}> = [
  { top: "4%",  left: "62%", size: 70, variant: 1, color: "text-primary",     anim: "animate-dice-float", delay: "-1s" },
  { top: "14%", left: "10%", size: 56, variant: 2, color: "text-gold",        anim: "animate-dice-drift", delay: "-4s" },
  { top: "32%", left: "72%", size: 60, variant: 3, color: "text-destructive", anim: "animate-dice-float", delay: "-6s" },
  { top: "46%", left: "20%", size: 50, variant: 1, color: "text-accent",      anim: "animate-dice-drift", delay: "-2s" },
  { top: "60%", left: "65%", size: 64, variant: 2, color: "text-secondary",   anim: "animate-dice-float", delay: "-8s" },
  { top: "76%", left: "8%",  size: 58, variant: 3, color: "text-primary",     anim: "animate-dice-drift", delay: "-10s" },
  { top: "88%", left: "55%", size: 48, variant: 1, color: "text-gold",        anim: "animate-dice-float", delay: "-12s" },
];

export function MonsterGhostBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
      suppressHydrationWarning
    >
      {PIECES.map((p, i) => (
        <div
          key={i}
          className={`absolute opacity-[0.07] ${p.color} ${p.anim}`}
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            filter: "drop-shadow(0 0 10px currentColor)",
          }}
        >
          <Ghost variant={p.variant} />
        </div>
      ))}
    </div>
  );
}
