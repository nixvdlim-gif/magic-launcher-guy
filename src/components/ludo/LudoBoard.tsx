import { useMemo } from "react";

export type Coord = { r: number; c: number };
export type LudoToken = { pos: number };
export type LudoPState = { tokens: LudoToken[] };

export const LUDO_PLAYERS = [
  { name: "Red", hex: "#e53935", light: "#ffebee", start: 0, baseCenter: { r: 2.5, c: 2.5 } },
  { name: "Green", hex: "#43a047", light: "#e8f5e9", start: 13, baseCenter: { r: 2.5, c: 11.5 } },
  { name: "Yellow", hex: "#fdd835", light: "#fffde7", start: 26, baseCenter: { r: 11.5, c: 11.5 } },
  { name: "Blue", hex: "#1e88e5", light: "#e3f2fd", start: 39, baseCenter: { r: 11.5, c: 2.5 } },
];

const SAFE_GLOBAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function buildMainPath(): Coord[] {
  const p: Coord[] = [];
  for (let c = 1; c <= 5; c++) p.push({ r: 6, c });
  for (let r = 5; r >= 1; r--) p.push({ r, c: 6 });
  p.push({ r: 0, c: 6 });
  p.push({ r: 0, c: 7 });
  p.push({ r: 0, c: 8 });
  for (let r = 1; r <= 5; r++) p.push({ r, c: 8 });
  for (let c = 9; c <= 13; c++) p.push({ r: 6, c });
  p.push({ r: 6, c: 14 });
  p.push({ r: 7, c: 14 });
  p.push({ r: 8, c: 14 });
  for (let c = 13; c >= 9; c--) p.push({ r: 8, c });
  for (let r = 9; r <= 13; r++) p.push({ r, c: 8 });
  p.push({ r: 14, c: 8 });
  p.push({ r: 14, c: 7 });
  p.push({ r: 14, c: 6 });
  for (let r = 13; r >= 9; r--) p.push({ r, c: 6 });
  for (let c = 5; c >= 1; c--) p.push({ r: 8, c });
  p.push({ r: 8, c: 0 });
  p.push({ r: 7, c: 0 });
  p.push({ r: 6, c: 0 });
  return p;
}

export const MAIN_PATH = buildMainPath();

export const HOME_COLUMNS: Coord[][] = [
  [
    { r: 7, c: 1 },
    { r: 7, c: 2 },
    { r: 7, c: 3 },
    { r: 7, c: 4 },
    { r: 7, c: 5 },
    { r: 7, c: 7 },
  ],
  [
    { r: 1, c: 7 },
    { r: 2, c: 7 },
    { r: 3, c: 7 },
    { r: 4, c: 7 },
    { r: 5, c: 7 },
    { r: 7, c: 7 },
  ],
  [
    { r: 7, c: 13 },
    { r: 7, c: 12 },
    { r: 7, c: 11 },
    { r: 7, c: 10 },
    { r: 7, c: 9 },
    { r: 7, c: 7 },
  ],
  [
    { r: 13, c: 7 },
    { r: 12, c: 7 },
    { r: 11, c: 7 },
    { r: 10, c: 7 },
    { r: 9, c: 7 },
    { r: 7, c: 7 },
  ],
];

export function tokenCoord(playerIdx: number, pos: number): Coord {
  if (pos < 0) return LUDO_PLAYERS[playerIdx].baseCenter;
  if (pos <= 51) {
    const g = (LUDO_PLAYERS[playerIdx].start + pos) % 52;
    return MAIN_PATH[g];
  }
  return HOME_COLUMNS[playerIdx][Math.min(pos - 52, 5)];
}

function shade(hex: string, percent: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round((255 * percent) / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * percent) / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round((255 * percent) / 100)));
  return `rgb(${r},${g},${b})`;
}

export function DicePips({ value, color }: { value: number; color: string }) {
  const positions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [
      [25, 25],
      [75, 75],
    ],
    3: [
      [25, 25],
      [50, 50],
      [75, 75],
    ],
    4: [
      [25, 25],
      [25, 75],
      [75, 25],
      [75, 75],
    ],
    5: [
      [25, 25],
      [25, 75],
      [50, 50],
      [75, 25],
      [75, 75],
    ],
    6: [
      [25, 20],
      [25, 50],
      [25, 80],
      [75, 20],
      [75, 50],
      [75, 80],
    ],
  };
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {positions[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={color} />
      ))}
    </svg>
  );
}

type Props = {
  state: LudoPState[];
  highlightTokens?: { pi: number; ti: number }[];
  currentTurn?: number;
  onTokenClick?: (pi: number, ti: number) => void;
  /** rotate the entire board by this many degrees (token icons stay upright) */
  rotate?: number;
};

export function LudoBoard({
  state,
  highlightTokens = [],
  currentTurn,
  onTokenClick,
  rotate = 0,
}: Props) {
  // Exact visual centers for the four parking spots inside each 6x6 base.
  // These are board-grid center coordinates, not top-left cell coordinates.
  const BASE_SPOTS: Coord[][] = [
    [
      { r: 2, c: 2 },
      { r: 2, c: 4 },
      { r: 4, c: 2 },
      { r: 4, c: 4 },
    ],
    [
      { r: 2, c: 11 },
      { r: 2, c: 13 },
      { r: 4, c: 11 },
      { r: 4, c: 13 },
    ],
    [
      { r: 11, c: 11 },
      { r: 11, c: 13 },
      { r: 13, c: 11 },
      { r: 13, c: 13 },
    ],
    [
      { r: 11, c: 2 },
      { r: 11, c: 4 },
      { r: 13, c: 2 },
      { r: 13, c: 4 },
    ],
  ];

  const cellPct = 100 / 15;

  const pathCells = useMemo(() => {
    const arr: {
      r: number;
      c: number;
      bg: string;
      star?: boolean;
      arrow?: { dir: "up" | "down" | "left" | "right"; color: string };
    }[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) continue;
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

        let bg = "#ffffff";
        HOME_COLUMNS.forEach((col, pi) => {
          col.slice(0, 5).forEach((cc) => {
            if (cc.r === r && cc.c === c) bg = LUDO_PLAYERS[pi].hex;
          });
        });

        let star = false;
        const pathIdx = MAIN_PATH.findIndex((cc) => cc.r === r && cc.c === c);
        if (
          pathIdx >= 0 &&
          SAFE_GLOBAL.has(pathIdx) &&
          !LUDO_PLAYERS.some((p) => p.start === pathIdx)
        ) {
          star = true;
        }
        let arrow: { dir: "up" | "down" | "left" | "right"; color: string } | undefined;
        const startPlayer = LUDO_PLAYERS.findIndex((p) => p.start === pathIdx);
        if (startPlayer >= 0) {
          bg = LUDO_PLAYERS[startPlayer].hex;
          const dirs = ["right", "down", "left", "up"] as const;
          arrow = { dir: dirs[startPlayer], color: "#ffffff" };
        }

        arr.push({ r, c, bg, star, arrow });
      }
    }
    return arr;
  }, []);

  return (
    <div
      className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: "transparent",
        padding: 0,
        boxShadow: "none",
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        transition: "transform 400ms ease",
      }}
    >
      <div
        className="relative w-full h-full bg-white overflow-hidden rounded-2xl"
      >
        {LUDO_PLAYERS.map((p, pi) => {
          const positions = [
            { top: 0, left: 0 },
            { top: 0, right: 0 },
            { bottom: 0, right: 0 },
            { bottom: 0, left: 0 },
          ];
          const pos = positions[pi];
          return (
            <div
              key={`quad-${pi}`}
              className="absolute"
              style={{
                ...pos,
                width: `${cellPct * 6}%`,
                height: `${cellPct * 6}%`,
                background: p.hex,
                padding: 0,
              }}
            >
              <div
                className="absolute bg-white"
                style={{
                  top: "16%",
                  left: "16%",
                  width: "68%",
                  height: "68%",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                }}
              />
            </div>
          );
        })}

        {pathCells.map((cell, i) => (
          <div
            key={`path-${i}`}
            className="absolute flex items-center justify-center"
            style={{
              top: `${cell.r * cellPct}%`,
              left: `${cell.c * cellPct}%`,
              width: `${cellPct}%`,
              height: `${cellPct}%`,
              background: cell.bg,
              boxShadow: "inset 0 0 0 1px #94a3b8",
            }}
          >
            {cell.star && (
              <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 opacity-70" fill="#1e293b">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            )}
            {cell.arrow && (
              <svg
                viewBox="0 0 24 24"
                className="w-3/4 h-3/4"
                style={{
                  transform: `rotate(${cell.arrow.dir === "right" ? 0 : cell.arrow.dir === "down" ? 90 : cell.arrow.dir === "left" ? 180 : 270}deg)`,
                }}
              >
                <path
                  d="M4 12h12m0 0l-5-5m5 5l-5 5"
                  stroke={cell.arrow.color}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}

        <div
          className="absolute"
          style={{
            top: `${6 * cellPct}%`,
            left: `${6 * cellPct}%`,
            width: `${3 * cellPct}%`,
            height: `${3 * cellPct}%`,
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon points="0,0 100,0 50,50" fill={LUDO_PLAYERS[1].hex} />
            <polygon points="100,0 100,100 50,50" fill={LUDO_PLAYERS[2].hex} />
            <polygon points="100,100 0,100 50,50" fill={LUDO_PLAYERS[3].hex} />
            <polygon points="0,100 0,0 50,50" fill={LUDO_PLAYERS[0].hex} />
            <circle cx="50" cy="50" r="10" fill="white" stroke="#0d2847" strokeWidth="2" />
          </svg>
        </div>

        {/* Base spot discs (colored circles where tokens park) — LudoKing style */}
        {LUDO_PLAYERS.map((_p, pi) =>
          BASE_SPOTS[pi].map((spot, si) => {
            const discSize = 1.05;
            return (
              <div
                key={`spot-${pi}-${si}`}
                className="absolute rounded-full"
                style={{
                  top: `${(spot.r - discSize / 2) * cellPct}%`,
                  left: `${(spot.c - discSize / 2) * cellPct}%`,
                  width: `${cellPct * discSize}%`,
                  height: `${cellPct * discSize}%`,
                  background: LUDO_PLAYERS[pi].hex,
                  boxShadow: `inset 0 0 0 2px #ffffff, 0 1px 3px rgba(0,0,0,0.3)`,
                  opacity: 0.9,
                }}
              />
            );
          }),
        )}

        {state.map((p, pi) => {
          const baseSpots = BASE_SPOTS[pi];
          let baseUsed = 0;
          return p.tokens.map((t, ti) => {
            let coord: Coord;
            if (t.pos === -1) coord = baseSpots[baseUsed++];
            else coord = tokenCoord(pi, t.pos);
            const samePos = state
              .flatMap((pp, ppi) => pp.tokens.map((tt, tti) => ({ pi: ppi, ti: tti, t: tt })))
              .filter((x) => {
                if (x.t.pos === -1 || t.pos === -1) return false;
                const a = tokenCoord(x.pi, x.t.pos);
                return a.r === coord.r && a.c === coord.c;
              });
            const stackIdx = Math.max(
              0,
              samePos.findIndex((x) => x.pi === pi && x.ti === ti),
            );
            const offX = samePos.length > 1 ? (stackIdx % 2) * 1.4 - 0.7 : 0;
            const offY = samePos.length > 1 ? Math.floor(stackIdx / 2) * 1.4 - 0.7 : 0;
            const canMove = highlightTokens.some((h) => h.pi === pi && h.ti === ti);
            const isCurrent = currentTurn === pi;
            const inBase = t.pos === -1;
            const sizeMul = inBase ? 1.08 : 1.05;
            // Pin head circle sits at SVG y=28 of 96 → 29.17% from top of box.
            // For base spots coord is already the exact disc center; for path cells
            // coord is a cell address, so add 0.5 to target its center.
            const HEAD_FRAC = 0.5; // round token: center == box center
            const boxW = cellPct * sizeMul; // % of board
            const boxH = cellPct * sizeMul;
            const centerR = inBase ? coord.r : coord.r + 0.5;
            const centerC = inBase ? coord.c : coord.c + 0.5;
            const topPct = centerR * cellPct - HEAD_FRAC * boxH;
            const leftPct = centerC * cellPct - boxW / 2;

            return (
              <button
                key={`tok-${pi}-${ti}`}
                onClick={() => onTokenClick?.(pi, ti)}
                disabled={!canMove}
                aria-label={`${LUDO_PLAYERS[pi].name} token ${ti + 1}`}
                className={`absolute transition-all ${canMove ? "cursor-pointer animate-pulse" : "cursor-default"}`}
                style={{
                  top: `calc(${topPct}% + ${offY}%)`,
                  left: `calc(${leftPct}% + ${offX}%)`,
                  width: `${boxW}%`,
                  height: `${boxH}%`,
                  zIndex: isCurrent ? 20 : 10,
                  opacity: t.pos === 57 ? 0.55 : 1,
                  padding: 0,
                }}
              >
                <div
                  className="w-full h-full relative"
                  style={{
                    filter: canMove
                      ? "drop-shadow(0 0 5px #fde047) drop-shadow(0 3px 3px rgba(0,0,0,0.45))"
                      : "drop-shadow(0 3px 3px rgba(0,0,0,0.5))",
                    transform: rotate ? `rotate(${-rotate}deg)` : undefined,
                    transition: "transform 400ms ease",
                  }}
                >
                  {/* Round token */}
                  <svg
                    viewBox="0 0 64 64"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <radialGradient id={`pinGrad-${pi}`} cx="38%" cy="32%" r="65%">
                        <stop offset="0%" stopColor={LUDO_PLAYERS[pi].light} />
                        <stop offset="55%" stopColor={LUDO_PLAYERS[pi].hex} />
                        <stop offset="100%" stopColor={shade(LUDO_PLAYERS[pi].hex, -25)} />
                      </radialGradient>
                    </defs>
                    <circle
                      cx="32"
                      cy="32"
                      r="27"
                      fill={`url(#pinGrad-${pi})`}
                      stroke="#ffffff"
                      strokeWidth="3.5"
                    />
                    <circle cx="32" cy="32" r="11" fill="#ffffff" />
                    <circle cx="32" cy="32" r="6.5" fill={shade(LUDO_PLAYERS[pi].hex, -10)} />
                    <ellipse cx="24" cy="22" rx="6" ry="3" fill="rgba(255,255,255,0.55)" />
                  </svg>
                </div>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
