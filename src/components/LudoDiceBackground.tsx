import React from "react";

/**
 * Low-opacity floating ludo dice rendered behind page content.
 * Pure CSS animation — no JS overhead.
 */
function Dice({ pips }: { pips: number }) {
  const dot = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r="6" fill="currentColor" />
  );
  const layout: Record<number, [number, number][]> = {
    1: [[32, 32]],
    2: [[16, 16], [48, 48]],
    3: [[14, 14], [32, 32], [50, 50]],
    4: [[16, 16], [48, 16], [16, 48], [48, 48]],
    5: [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48]],
    6: [[16, 14], [48, 14], [16, 32], [48, 32], [16, 50], [48, 50]],
  };
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect x="2" y="2" width="60" height="60" rx="12" fill="currentColor" opacity="0.18" />
      <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <g>{layout[pips].map(([x, y], i) => <React.Fragment key={i}>{dot(x, y)}</React.Fragment>)}</g>
    </svg>
  );
}

const PIECES = [
  { top: "6%",  left: "8%",  size: 64, pips: 5, color: "text-primary",   anim: "animate-dice-float", delay: "0s" },
  { top: "18%", left: "78%", size: 52, pips: 3, color: "text-gold",      anim: "animate-dice-drift", delay: "-3s" },
  { top: "42%", left: "4%",  size: 48, pips: 6, color: "text-accent",    anim: "animate-dice-drift", delay: "-7s" },
  { top: "55%", left: "82%", size: 70, pips: 2, color: "text-secondary", anim: "animate-dice-float", delay: "-2s" },
  { top: "72%", left: "12%", size: 56, pips: 4, color: "text-primary",   anim: "animate-dice-float", delay: "-5s" },
  { top: "85%", left: "70%", size: 50, pips: 1, color: "text-gold",      anim: "animate-dice-drift", delay: "-9s" },
  { top: "30%", left: "45%", size: 44, pips: 6, color: "text-accent",    anim: "animate-dice-float", delay: "-11s" },
];

export function LudoDiceBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
      suppressHydrationWarning
    >
      {PIECES.map((p, i) => (
        <div
          key={i}
          className={`absolute opacity-[0.09] ${p.color} ${p.anim}`}
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
          }}
        >
          <Dice pips={p.pips} />
        </div>
      ))}
    </div>
  );
}