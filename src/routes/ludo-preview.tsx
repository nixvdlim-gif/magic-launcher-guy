import { createFileRoute } from "@tanstack/react-router";
import { LudoBoard, LUDO_PLAYERS } from "@/components/ludo/LudoBoard";

export const Route = createFileRoute("/ludo-preview")({
  component: LudoPreview,
});

function LudoPreview() {
  const state = LUDO_PLAYERS.map((_, i) => ({
    tokens: [{ pos: i === 0 ? 5 : i === 1 ? -1 : i === 2 ? 20 : 52 },
             { pos: -1 }, { pos: -1 }, { pos: -1 }],
  }));
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LudoBoard state={state} currentTurn={0} highlightTokens={[{ pi: 0, ti: 0 }]} onTokenClick={() => {}} />
      </div>
    </div>
  );
}