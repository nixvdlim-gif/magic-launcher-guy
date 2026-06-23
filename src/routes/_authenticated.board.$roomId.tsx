import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Trophy, Dices, MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LudoBoard, LUDO_PLAYERS, DicePips } from "@/components/ludo/LudoBoard";
import { sfx, isMuted, setMuted } from "@/lib/sounds";
import { Volume2, VolumeX } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Search = { entry?: number; prize?: number; max?: number; mode?: string };

export const Route = createFileRoute("/_authenticated/board/$roomId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    entry: s.entry ? Number(s.entry) : 10,
    prize: s.prize ? Number(s.prize) : 36,
    max: s.max ? Number(s.max) : 4,
    mode: s.mode ? String(s.mode) : "classic",
  }),
  component: BoardPage,
});

/* ============ Ludo engine ============
   Standard Ludo: 52-cell main loop, 4 players, 4 tokens each.
   Each player has a starting cell offset (0,13,26,39) and a 6-cell home column.
   Token positions: -1 = base, 0..51 = main path (relative to player start),
   52..56 = home column, 57 = home (finished).
   Safe squares (relative to global cell 0): 0,8,13,21,26,34,39,47.
*/

const PLAYERS = [
  { name: "Red",    bg: "bg-red-500",    text: "text-red-500",    start: 0,  base: { row: 1.5,  col: 1.5  }, hexBg: "#ef4444" },
  { name: "Green",  bg: "bg-green-500",  text: "text-green-500",  start: 13, base: { row: 1.5,  col: 10.5 }, hexBg: "#22c55e" },
  { name: "Yellow", bg: "bg-yellow-400", text: "text-yellow-400", start: 26, base: { row: 10.5, col: 10.5 }, hexBg: "#facc15" },
  { name: "Blue",   bg: "bg-blue-500",   text: "text-blue-500",   start: 39, base: { row: 10.5, col: 1.5  }, hexBg: "#3b82f6" },
];

const SAFE_GLOBAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Build the 52-cell main path coords on a 15x15 grid (row,col), starting from Red's entry.
function buildMainPath(): { r: number; c: number }[] {
  const p: { r: number; c: number }[] = [];
  // Red entry: row 6, col 1 -> col 5 (left arm bottom -> top)
  for (let c = 1; c <= 5; c++) p.push({ r: 6, c });            // 0..4
  // up the left of green column
  for (let r = 5; r >= 1; r--) p.push({ r, c: 6 });            // 5..9
  p.push({ r: 0, c: 6 });                                      // 10
  p.push({ r: 0, c: 7 });                                      // 11
  p.push({ r: 0, c: 8 });                                      // 12
  // Green entry at index 13: row 1 col 8 then down
  for (let r = 1; r <= 5; r++) p.push({ r, c: 8 });            // 13..17
  for (let c = 9; c <= 13; c++) p.push({ r: 6, c });           // 18..22
  p.push({ r: 6, c: 14 });                                     // 23
  p.push({ r: 7, c: 14 });                                     // 24
  p.push({ r: 8, c: 14 });                                     // 25
  // Yellow entry at index 26: row 8 col 13 then left
  for (let c = 13; c >= 9; c--) p.push({ r: 8, c });           // 26..30
  for (let r = 9; r <= 13; r++) p.push({ r, c: 8 });           // 31..35
  p.push({ r: 14, c: 8 });                                     // 36
  p.push({ r: 14, c: 7 });                                     // 37
  p.push({ r: 14, c: 6 });                                     // 38
  // Blue entry at index 39: row 13 col 6 then up
  for (let r = 13; r >= 9; r--) p.push({ r, c: 6 });           // 39..43
  for (let c = 5; c >= 1; c--) p.push({ r: 8, c });            // 44..48
  p.push({ r: 8, c: 0 });                                      // 49
  p.push({ r: 7, c: 0 });                                      // 50
  p.push({ r: 6, c: 0 });                                      // 51
  return p;
}

const HOME_COLUMNS: { r: number; c: number }[][] = [
  // Red home column: row 7, col 1->5  (then center)
  [{r:7,c:1},{r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:7}],
  // Green: col 7, row 1->5
  [{r:1,c:7},{r:2,c:7},{r:3,c:7},{r:4,c:7},{r:5,c:7},{r:7,c:7}],
  // Yellow: row 7, col 13->9
  [{r:7,c:13},{r:7,c:12},{r:7,c:11},{r:7,c:10},{r:7,c:9},{r:7,c:7}],
  // Blue: col 7, row 13->9
  [{r:13,c:7},{r:12,c:7},{r:11,c:7},{r:10,c:7},{r:9,c:7},{r:7,c:7}],
];

const MAIN_PATH = buildMainPath();

type Token = { pos: number }; // -1 base, 0..51 main, 52..57 home column (52..56 cells, 57=finished)
type PState = { tokens: Token[] };

function tokenCoord(playerIdx: number, pos: number): { r: number; c: number } {
  if (pos < 0) {
    const b = PLAYERS[playerIdx].base;
    return { r: b.row, c: b.col };
  }
  if (pos <= 51) {
    const globalCell = (PLAYERS[playerIdx].start + pos) % 52;
    return MAIN_PATH[globalCell];
  }
  const homeIdx = pos - 52; // 0..5
  return HOME_COLUMNS[playerIdx][Math.min(homeIdx, 5)];
}

function isSafe(playerIdx: number, pos: number): boolean {
  if (pos < 0 || pos > 51) return true;
  const g = (PLAYERS[playerIdx].start + pos) % 52;
  return SAFE_GLOBAL.has(g);
}

function legalMoves(state: PState[], playerIdx: number, dice: number): number[] {
  const me = state[playerIdx];
  const moves: number[] = [];
  me.tokens.forEach((t, i) => {
    if (t.pos === 57) return; // finished
    if (t.pos === -1) {
      if (dice === 6) moves.push(i);
      return;
    }
    const np = t.pos + dice;
    if (np > 57) return; // can't overshoot home
    // can't land on own non-safe token? In standard Ludo you can stack — allowed.
    moves.push(i);
  });
  return moves;
}

function applyMove(
  state: PState[],
  playerIdx: number,
  tokenIdx: number,
  dice: number
): { state: PState[]; captured: boolean; finished: boolean } {
  const next = state.map((p) => ({ tokens: p.tokens.map((t) => ({ ...t })) }));
  const tok = next[playerIdx].tokens[tokenIdx];
  let captured = false;
  if (tok.pos === -1 && dice === 6) {
    tok.pos = 0;
  } else {
    tok.pos += dice;
  }
  // Capture: if landing on main path and not safe, remove opponents on same cell
  if (tok.pos >= 0 && tok.pos <= 51 && !isSafe(playerIdx, tok.pos)) {
    const myG = (PLAYERS[playerIdx].start + tok.pos) % 52;
    next.forEach((p, pi) => {
      if (pi === playerIdx) return;
      p.tokens.forEach((ot) => {
        if (ot.pos >= 0 && ot.pos <= 51) {
          const og = (PLAYERS[pi].start + ot.pos) % 52;
          if (og === myG) {
            ot.pos = -1;
            captured = true;
          }
        }
      });
    });
  }
  const finished = next[playerIdx].tokens.every((t) => t.pos === 57);
  return { state: next, captured, finished };
}

function botPickToken(state: PState[], playerIdx: number, dice: number, skill: number): number {
  const moves = legalMoves(state, playerIdx, dice);
  if (moves.length === 0) return -1;
  // Score each candidate
  let best = moves[0];
  let bestScore = -1e9;
  for (const m of moves) {
    const tok = state[playerIdx].tokens[m];
    let score = 0;
    // simulate
    const sim = applyMove(state, playerIdx, m, dice);
    if (sim.captured) score += 100;
    if (sim.finished) score += 200;
    // prefer to advance further tokens
    score += (tok.pos < 0 ? 0 : tok.pos) * 0.5;
    // entering home column
    if (tok.pos + dice >= 52) score += 30;
    // leaving base on 6
    if (tok.pos === -1 && dice === 6) score += 20;
    // small randomness based on skill
    score += Math.random() * (10 - skill);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function BoardPage() {
  const { roomId } = useParams({ from: "/_authenticated/board/$roomId" });
  const search = useSearch({ from: "/_authenticated/board/$roomId" });
  const { lang } = useI18n();
  const c = useCurrency();
  const nav = useNavigate();
  const max = Math.min(4, Math.max(2, Number(search.max ?? 4))) as 2 | 3 | 4;
  const entry = Number(search.entry ?? 0);
  const prize = Number(search.prize ?? 0);

  const [state, setState] = useState<PState[]>(() =>
    Array.from({ length: max }, () => ({ tokens: [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }] })),
  );
  const [dice, setDice] = useState<number | null>(null);
  const [turn, setTurn] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [waitingMove, setWaitingMove] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [over, setOver] = useState<null | "won" | "lost">(null);
  const startedAt = useRef(Date.now());
  const finalizedRef = useRef(false);
  const timeoutRequestRef = useRef<number | null>(null);
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const TURN_SECONDS = 30;
  const [rematching, setRematching] = useState(false);
  const [rematchInvite, setRematchInvite] = useState<{ roomId: string; from: string } | null>(null);

  // ── Bot win-rate (set once on mount based on admin config) ──
  // botSkill = 9 → strong (bot likely wins). botSkill = 1 → weak (bot likely loses to human).
  const [botSkill, setBotSkill] = useState<number>(6);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "bot_config").maybeSingle();
      const cfg: any = data?.value ?? {};
      const mode = String(search.mode ?? "classic");
      const winRate = Number(cfg?.per_mode?.[mode]?.win_rate ?? cfg?.win_rate ?? 40);
      const botShouldWin = Math.random() * 100 < winRate;
      setBotSkill(botShouldWin ? 9 : 1);
    })();
  }, []);

  // ── Room chat ──
  type ChatMsg = { id: string; seat: number; name: string; body: string; ts: number; emoji?: boolean };
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const chatChanRef = useRef<RealtimeChannel | null>(null);

  // ── Disconnect grace ──
  const [absentSeats, setAbsentSeats] = useState<Record<number, number>>({}); // seat -> since(ms)
  const [graceTick, setGraceTick] = useState(0);
  const GRACE_SECONDS = 60;

  // ── Consecutive dice-miss counter (timeout based) ──
  // misses[seat] = 0..3. 3 ⇒ that player forfeits.
  const [misses, setMisses] = useState<number[]>(() => Array.from({ length: max }, () => 0));
  const lastTurnRef = useRef<number>(0);
  const turnHadRollRef = useRef<boolean>(false);

  // ===== Multiplayer sync =====
  const [userId, setUserId] = useState<string | null>(null);
  const [seats, setSeats] = useState<{ user_id: string; seat: number; is_bot: boolean }[]>([]);
  const [seatUsernames, setSeatUsernames] = useState<Record<string, string>>({});
  const [hostId, setHostId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMulti = seats.length > 0;
  const mySeat = useMemo(
    () => seats.find((s) => !s.is_bot && s.user_id === userId)?.seat ?? null,
    [seats, userId],
  );
  const isHost = userId !== null && hostId === userId;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: room } = await supabase
        .from("game_rooms")
        .select("host_id, state, current_turn, status, turn_started_at, turn_seconds")
        .eq("id", roomId)
        .maybeSingle();
      if (room) {
        setHostId(room.host_id);
        // Restore persisted snapshot (reconnect)
        const snap = (room.state ?? {}) as any;
        if (snap && Array.isArray(snap.players) && snap.players.length === max) {
          setState(snap.players);
          setTurn(typeof snap.turn === "number" ? snap.turn : (room.current_turn ?? 0));
          if (typeof snap.dice === "number") setDice(snap.dice);
          if (snap.startedAt) startedAt.current = snap.startedAt;
          addLog(lang === "bn" ? "🔄 পুনরায় সংযুক্ত হয়েছেন" : "🔄 Reconnected");
        }
        if ((room as any).turn_started_at) {
          const sec = (room as any).turn_seconds ?? TURN_SECONDS;
          setTurnDeadline(new Date((room as any).turn_started_at).getTime() + sec * 1000);
        }
        if (room.status === "finished") setOver("lost");
      }
      const { data: s } = await supabase
        .from("game_room_players")
        .select("user_id, seat, is_bot")
        .eq("room_id", roomId)
        .order("seat", { ascending: true });
      setSeats((s ?? []) as any);
      const humanIds = (s ?? []).filter((x: any) => !x.is_bot && x.user_id).map((x: any) => x.user_id);
      if (humanIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", humanIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.username; });
        setSeatUsernames(map);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, max]);

  // Broadcast channel for game actions
  useEffect(() => {
    if (!isMulti || mySeat === null) return;
    const ch = supabase.channel(`room:${roomId}:game`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "dice" }, ({ payload }) => {
      setDice(payload.value);
      setTurn(payload.seat);
      setMisses((prev) => { const n = [...prev]; n[payload.seat] = 0; return n; });
      addLog(`${playerNames[payload.seat] ?? "P" + payload.seat} 🎲 ${payload.value}`);
    });

    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      (async () => {
        const res = await animateMoveRef.current!(payload.seat, payload.tokenIdx, payload.dice);
        if (res.captured) addLog(lang === "bn" ? `${playerNamesRef.current[payload.seat]} ক্যাপচার!` : `${playerNamesRef.current[payload.seat]} captured!`);
        if (res.finished) {
          addLog(`${playerNamesRef.current[payload.seat]} 🏆`);
          setTimeout(() => finalize(payload.seat === mySeat), 500);
        } else {
          setTimeout(() => {
            setDice(null);
            if (payload.dice !== 6) setTurn((payload.seat + 1) % max);
          }, 350);
        }
      })();
    });

    ch.on("broadcast", { event: "skip" }, ({ payload }) => {
      addLog(lang === "bn" ? "কোনো চাল নেই" : "No moves");
      setTimeout(() => {
        setDice(null);
        if (payload.dice !== 6) setTurn((payload.seat + 1) % max);
      }, 600);
    });

    // ── Miss (timeout) sync across clients ──
    ch.on("broadcast", { event: "miss" }, ({ payload }) => {
      handleMissRef.current?.(payload.seat);
    });

    // ── Reconnect: late joiner asks host for current snapshot ──
    ch.on("broadcast", { event: "sync_request" }, ({ payload }) => {
      if (!isHost) return;
      channelRef.current?.send({
        type: "broadcast",
        event: "sync_state",
        payload: {
          to: payload.from,
          players: state,
          turn,
          dice,
          startedAt: startedAt.current,
        },
      });
    });

    ch.on("broadcast", { event: "sync_state" }, ({ payload }) => {
      if (payload.to !== mySeat) return;
      if (Array.isArray(payload.players) && payload.players.length === max) {
        setState(payload.players);
        setTurn(payload.turn ?? 0);
        setDice(payload.dice ?? null);
        if (payload.startedAt) startedAt.current = payload.startedAt;
        addLog(lang === "bn" ? "✅ স্টেট সিঙ্ক হয়েছে" : "✅ State synced");
      }
    });

    // ── Rematch invite from host ──
    ch.on("broadcast", { event: "rematch" }, ({ payload }) => {
      if (payload.roomId) {
        setRematchInvite({ roomId: payload.roomId, from: payload.fromName ?? "Host" });
      }
    });

    ch.subscribe();
    channelRef.current = ch;

    // Ask host for the latest snapshot on (re)connect
    setTimeout(() => {
      if (!isHost && mySeat !== null) {
        ch.send({ type: "broadcast", event: "sync_request", payload: { from: mySeat } });
      }
    }, 500);

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti, mySeat, roomId, max, isHost]);

  // ── Chat channel (broadcast) ──
  useEffect(() => {
    if (!isMulti || mySeat === null) return;
    const ch = supabase.channel(`room:${roomId}:chat`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setChatMsgs((prev) => [...prev, payload as ChatMsg].slice(-50));
      if (!chatOpen) setUnreadChat((n) => n + 1);
    });
    ch.subscribe();
    chatChanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chatChanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti, mySeat, roomId, chatOpen]);

  // ── Presence on game channel for disconnect grace ──
  useEffect(() => {
    if (!isMulti || mySeat === null || !userId) return;
    // Use a dedicated channel so we can register presence callbacks BEFORE subscribe()
    const ch = supabase.channel(`room:${roomId}:presence`, {
      config: { presence: { key: `seat-${mySeat}` } },
    });
    const presKey = `seat-${mySeat}`;
    const handler = () => {
      const stateMap = ch.presenceState() as Record<string, Array<{ seat: number; userId: string }>>;
      const presentSeats = new Set<number>();
      Object.values(stateMap).forEach((arr) => arr.forEach((p) => presentSeats.add(p.seat)));
      const humanSeats = seats.filter((s) => !s.is_bot).map((s) => s.seat);
      setAbsentSeats((prev) => {
        const next = { ...prev };
        humanSeats.forEach((sNum) => {
          if (presentSeats.has(sNum)) {
            if (next[sNum]) {
              addLog(lang === "bn" ? `${playerNames[sNum]} ফিরে এসেছেন ✓` : `${playerNames[sNum]} reconnected ✓`);
              delete next[sNum];
            }
          } else if (sNum !== mySeat && !next[sNum]) {
            next[sNum] = Date.now();
            addLog(lang === "bn" ? `⚠ ${playerNames[sNum]} ডিসকানেক্টেড` : `⚠ ${playerNames[sNum]} disconnected`);
          }
        });
        return next;
      });
    };
    ch.on("presence", { event: "sync" }, handler);
    ch.on("presence", { event: "join" }, handler);
    ch.on("presence", { event: "leave" }, handler);
    const track = () => ch.track({ seat: mySeat, userId, key: presKey }).catch(() => {});
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") track();
    });
    const reTrack = setInterval(track, 15000);
    return () => {
      clearInterval(reTrack);
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti, mySeat, userId, seats]);

  // Tick for grace countdown UI
  useEffect(() => {
    if (Object.keys(absentSeats).length === 0) return;
    const id = setInterval(() => setGraceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [absentSeats]);

  // ── Realtime: subscribe to room turn changes for server-enforced timeouts ──
  useEffect(() => {
    if (!isMulti) return;
    const ch = supabase
      .channel(`room:${roomId}:meta`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        ({ new: row }: any) => {
          const snap = (row.state ?? {}) as any;
          if (!isHost && snap && Array.isArray(snap.players) && snap.players.length === max) {
            setState(snap.players);
          }
          if (row.turn_started_at) {
            const sec = row.turn_seconds ?? TURN_SECONDS;
            setTurnDeadline(new Date(row.turn_started_at).getTime() + sec * 1000);
          }
          if (typeof row.current_turn === "number" && row.current_turn !== turn) {
            // Server advanced the turn (timeout/skip). Clear dice so the next player can roll.
            setTurn(row.current_turn);
            setDice(null);
            setWaitingMove(false);
            setRolling(false);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isMulti, roomId, turn]);

  // ── Host: reset server turn timer whenever turn changes ──
  useEffect(() => {
    if (!isMulti || !isHost || over) return;
    supabase.rpc("update_turn_timer" as any, { _room_id: roomId, _turn: turn }).then(() => {});
  }, [turn, isMulti, isHost, roomId, over]);

  // ── Reset stuck UI state when turn changes (fixes Roll button stuck after timeout) ──
  // NOTE: do NOT clear `dice` here — it races with the multiplayer "dice" broadcast
  // (which sets dice + turn together) and would erase the opponent's roll from view.
  // `dice` is cleared explicitly by nextTurn / move / skip / timeout handlers.
  useEffect(() => {
    setWaitingMove(false);
    setRolling(false);
  }, [turn]);

  // ── Countdown + auto-timeout enforcement ──
  useEffect(() => {
    if (!isMulti || over || !turnDeadline) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0 && timeoutRequestRef.current !== turnDeadline) {
        timeoutRequestRef.current = turnDeadline;
        const missedSeat = turn;
        supabase.rpc("auto_timeout_turn" as any, { _room_id: roomId }).then(({ data }: any) => {
          if (data?.skipped) {
            addLog(lang === "bn" ? "⏱ সময় শেষ — পরবর্তী খেলোয়াড়" : "⏱ Time up — next player");
            handleMissRef.current?.(missedSeat);
          channelRef.current?.send({ type: "broadcast", event: "miss", payload: { seat: missedSeat } });
          sfx.miss();
          }
        });
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [turnDeadline, isMulti, over, roomId, lang, turn]);

  // ── Host: persist snapshot to DB on every change so reconnects can restore ──
  useEffect(() => {
    if (!isMulti || !isHost || over) return;
    const id = setTimeout(() => {
      supabase
        .from("game_rooms")
        .update({
          state: { players: state, turn, dice, startedAt: startedAt.current } as any,
          current_turn: turn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", roomId)
        .then(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [state, turn, dice, isMulti, isHost, roomId, over]);

  const broadcast = (event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  };

  // ── Step-by-step token animation (one cell at a time, then resolve capture) ──
  const animateMove = useCallback(
    async (pIdx: number, tokIdx: number, val: number): Promise<{ captured: boolean; finished: boolean }> => {
      let startPos = -2;
      setState((cur) => {
        startPos = cur[pIdx].tokens[tokIdx].pos;
        return cur;
      });
      await new Promise((r) => setTimeout(r, 0));
      const stepDelay = 160;
      if (startPos === -1 && val === 6) {
        setState((cur) => {
          const n = cur.map((p) => ({ tokens: p.tokens.map((t) => ({ ...t })) }));
          n[pIdx].tokens[tokIdx].pos = 0;
          return n;
        });
        sfx.tokenOut();
        await new Promise((r) => setTimeout(r, stepDelay + 60));
      } else if (startPos >= 0) {
        for (let i = 1; i <= val; i++) {
          setState((cur) => {
            const n = cur.map((p) => ({ tokens: p.tokens.map((t) => ({ ...t })) }));
            const t = n[pIdx].tokens[tokIdx];
            if (t.pos < 57) t.pos = Math.min(57, t.pos + 1);
            return n;
          });
          sfx.step();
          await new Promise((r) => setTimeout(r, stepDelay));
        }
      }
      let captured = false;
      let finished = false;
      setState((cur) => {
        const n = cur.map((p) => ({ tokens: p.tokens.map((t) => ({ ...t })) }));
        const tok = n[pIdx].tokens[tokIdx];
        let cap = false;
        if (tok.pos >= 0 && tok.pos <= 51 && !isSafe(pIdx, tok.pos)) {
          const myG = (PLAYERS[pIdx].start + tok.pos) % 52;
          n.forEach((p, pi) => {
            if (pi === pIdx) return;
            p.tokens.forEach((ot) => {
              if (ot.pos >= 0 && ot.pos <= 51) {
                const og = (PLAYERS[pi].start + ot.pos) % 52;
                if (og === myG) { ot.pos = -1; cap = true; }
              }
            });
          });
        }
        captured = cap;
        finished = n[pIdx].tokens.every((t) => t.pos === 57);
        return n;
      });
      // Ensure the updater above has been processed before reading flags
      await new Promise((r) => setTimeout(r, 0));
      if (captured) sfx.capture();
      if (finished) sfx.finish();
      return { captured, finished };

    },
    [],
  );
  const animateMoveRef = useRef(animateMove);
  useEffect(() => { animateMoveRef.current = animateMove; }, [animateMove]);

  // ── Miss handling: increment counter, forfeit at 3 ──
  const handleMissForSeat = useCallback(
    (seat: number) => {
      setMisses((prev) => {
        const next = [...prev];
        next[seat] = Math.min(3, (next[seat] ?? 0) + 1);
        const count = next[seat];
        addLog(
          lang === "bn"
            ? `⚠ ${playerNamesRef.current[seat] ?? "P" + seat} মিস (${count}/3)`
            : `⚠ ${playerNamesRef.current[seat] ?? "P" + seat} miss (${count}/3)`,
        );
        if (count >= 3 && !finalizedRef.current) {
          const myTurnSeat = isMulti ? mySeat : 0;
          // Determine outcome from this client's perspective
          if (seat === myTurnSeat) {
            addLog(lang === "bn" ? "৩ বার মিস — হেরেছেন" : "3 misses — you lost");
            setTimeout(() => finalize(false), 400);
          } else {
            // Count remaining (non-forfeited) human/bot seats
            const aliveCount = next.filter((m) => m < 3).length;
            if (aliveCount <= 1) {
              // Only one remains → that's me-or-someone; if I'm alive, I won
              if (myTurnSeat !== null && next[myTurnSeat] < 3) {
                setTimeout(() => finalize(true), 400);
              }
            }
          }
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, isMulti, mySeat],
  );

  // Keep a ref to playerNames so handleMissForSeat doesn't need it as a dep
  const playerNamesRef = useRef<string[]>([]);
  const handleMissRef = useRef<((seat: number) => void) | null>(null);

  const BOT_NAMES_BN = [
    "রাজু", "মীরা", "করিম", "জনি", "সোহান", "রিয়া", "তানভীর", "সাকিব", "তামিম", "মেহেদী",
    "আরিফ", "নিলয়", "রিফাত", "সোহাগ", "জুবায়ের", "ইমরান", "রাকিব", "শাকিল", "নাঈম", "শান্ত",
    "হৃদয়", "রাসেল", "মিজান", "হাসিব", "সুমন", "জুয়েল", "রবিন", "পাভেল", "অপন", "শিমুল",
    "শামীম", "কবির", "ফারুক", "জামাল", "সাজিদ", "তারেক", "লিটন", "মাসুদ", "নাহিদ", "পলাশ",
    "রাজীব", "সাইফুল", "তুহিন", "ওয়াসিম", "জাহিদ", "অনিক", "বাপ্পী", "দীপু", "ইমন", "ফরহাদ",
  ];
  const BOT_NAMES_EN = [
    "Raju", "Mira", "Karim", "Johny", "Sohan", "Riya", "Tanvir", "Sakib", "Tamim", "Mehedi",
    "Arif", "Niloy", "Rifat", "Sohag", "Jubayer", "Imran", "Rakib", "Shakil", "Nayeem", "Shanto",
    "Hridoy", "Rasel", "Mizan", "Hasib", "Sumon", "Jewel", "Robin", "Pavel", "Apon", "Shimul",
    "Shamim", "Kabir", "Faruk", "Jamal", "Sajid", "Tareq", "Liton", "Masud", "Nahid", "Polash",
    "Rajib", "Saiful", "Tuhin", "Wasim", "Zahid", "Anik", "Bappi", "Dipu", "Emon", "Forhad",
  ];
  const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const playerNames = useMemo(
    () =>
      Array.from({ length: max }, (_, i) => {
        const pool = lang === "bn" ? BOT_NAMES_BN : BOT_NAMES_EN;
        // Different name each room AND each seat — derive from roomId + seat
        const idx = hashStr(`${roomId}:${i}`) % pool.length;
        const botName = pool[idx];
        if (isMulti) {
          const s = seats.find((x) => x.seat === i);
          if (!s) return `Seat ${i + 1}`;
          if (s.is_bot) return botName;
          return seatUsernames[s.user_id] || (s.user_id === userId ? (lang === "bn" ? "আপনি" : "You") : `P${i + 1}`);
        }
        return i === 0 ? (lang === "bn" ? "আপনি" : "You") : botName;
      }),
    [max, lang, isMulti, seats, userId, seatUsernames, roomId],
  );

  useEffect(() => { playerNamesRef.current = playerNames; }, [playerNames]);
  useEffect(() => { handleMissRef.current = handleMissForSeat; }, [handleMissForSeat]);

  const addLog = (s: string) => setLog((l) => [s, ...l].slice(0, 12));

  const finalize = useCallback(
    async (won: boolean) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      setOver(won ? "won" : "lost");
      const dur = Math.floor((Date.now() - startedAt.current) / 1000);
      try {
        if (isMulti && isHost) {
          // Host finalizes multiplayer: pools entries, deducts commission, pays winner
          const winnerSeat = seats.find((s) => s.seat === turn && !s.is_bot);
          const { error } = await supabase.rpc("finish_multi_game" as any, {
            _room_id: roomId,
            _winner_id: winnerSeat?.user_id ?? null,
          });
          if (error) throw error;
        } else if (!isMulti) {
          const { error } = await supabase.rpc("finish_solo_game", {
            _room_id: roomId,
            _mode: "ludo",
            _entry_fee: entry,
            _prize: prize,
            _won: won,
            _duration: dur,
          });
          if (error) throw error;
        }
        if (won) toast.success(lang === "bn" ? `জিতেছেন! +${c}${prize}` : `You won! +${c}${prize}`);
        else toast(lang === "bn" ? "আবার চেষ্টা করুন!" : "Better luck next time!");
      if (won) sfx.win(); else sfx.lose();
      } catch (e: any) {
        toast.error(e.message ?? "Failed to record game");
      }
    },
    [entry, prize, roomId, lang, isMulti, isHost, seats, turn],
  );

  const nextTurn = useCallback(
    (gotSix: boolean) => {
      setDice(null);
      if (!gotSix) setTurn((t) => (t + 1) % max);
    },
    [max],
  );

  const performRoll = useCallback(
    (cb: (val: number) => void) => {
      setRolling(true);
      sfx.diceRoll();
      let i = 0;
      const t = setInterval(() => {
        setDice(1 + Math.floor(Math.random() * 6));
        if (++i > 6) {
          clearInterval(t);
          const final = 1 + Math.floor(Math.random() * 6);
          setDice(final);
          setRolling(false);
          sfx.diceLand(final);
          cb(final);
        }
      }, 70);
    },
    [],
  );

  const handlePlayerRoll = () => {
    const myTurnSeat = isMulti ? mySeat : 0;
    if (rolling || waitingMove || over || turn !== myTurnSeat || myTurnSeat === null) return;
    setMisses((prev) => { const n = [...prev]; n[myTurnSeat] = 0; return n; });
    performRoll((val) => {
      addLog(`${playerNames[myTurnSeat]} 🎲 ${val}`);
      if (isMulti) broadcast("dice", { seat: myTurnSeat, value: val });
      const moves = legalMoves(state, myTurnSeat, val);
      if (moves.length === 0) {
        addLog(lang === "bn" ? "কোনো চাল নেই" : "No moves");
        if (isMulti) broadcast("skip", { seat: myTurnSeat, dice: val });
        setTimeout(() => nextTurn(val === 6), 700);
        return;
      }
      if (moves.length === 1) {
        setTimeout(() => doMove(myTurnSeat, moves[0], val), 350);
      } else {
        setWaitingMove(true);
      }
    });
  };

  const doMove = async (pIdx: number, tokIdx: number, val: number) => {
    setWaitingMove(false);
    // Broadcast own moves; host also broadcasts bot moves so other clients animate them.
    if (isMulti) {
      const seatInfo = seats.find((s) => s.seat === pIdx);
      const isBotSeat = !!seatInfo?.is_bot;
      if (pIdx === mySeat || (isHost && isBotSeat)) {
        broadcast("move", { seat: pIdx, tokenIdx: tokIdx, dice: val });
      }
    }
    const res = await animateMove(pIdx, tokIdx, val);
    if (res.captured) addLog(lang === "bn" ? `${playerNames[pIdx]} ক্যাপচার!` : `${playerNames[pIdx]} captured!`);
    if (res.finished) {
      addLog(lang === "bn" ? `${playerNames[pIdx]} জিতেছে! 🏆` : `${playerNames[pIdx]} won! 🏆`);
      const myTurnSeat = isMulti ? mySeat : 0;
      setTimeout(() => finalize(pIdx === myTurnSeat), 600);
      return;
    }
    setTimeout(() => nextTurn(val === 6), 350);
  };


  // Bot turn
  useEffect(() => {
    if (over || rolling || waitingMove || dice !== null) return;
    // Solo: any non-zero seat is bot. Multi: only host runs bot turns, and only for bot seats.
    if (isMulti) {
      if (!isHost) return;
      const seatInfo = seats.find((s) => s.seat === turn);
      if (!seatInfo || !seatInfo.is_bot) return;
    } else {
      if (turn === 0) return;
    }
    const id = setTimeout(() => {
      setMisses((prev) => { const n = [...prev]; n[turn] = 0; return n; });
      performRoll((val) => {
        addLog(`${playerNames[turn]} 🎲 ${val}`);
        if (isMulti) broadcast("dice", { seat: turn, value: val });
        const moves = legalMoves(state, turn, val);
        if (moves.length === 0) {
          if (isMulti) broadcast("skip", { seat: turn, dice: val });
          setTimeout(() => nextTurn(val === 6), 600);
          return;
        }
        const pick = botPickToken(state, turn, val, botSkill);
        setTimeout(() => doMove(turn, pick, val), 400);
      });
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over, isMulti, isHost, seats, dice, rolling, waitingMove]);

  const onTokenClick = (pIdx: number, tokIdx: number) => {
    const myTurnSeat = isMulti ? mySeat : 0;
    if (!waitingMove || pIdx !== myTurnSeat || dice == null || myTurnSeat === null) return;
    const moves = legalMoves(state, myTurnSeat, dice);
    if (!moves.includes(tokIdx)) return;
    doMove(myTurnSeat, tokIdx, dice);
  };

  const onLeave = () => {
    if (over) { nav({ to: "/games" }); return; }
    if (confirm(lang === "bn" ? "গেম ছাড়লে এন্ট্রি ফেরত পাবেন না।" : "Leaving forfeits your entry.")) {
      finalize(false).then(() => nav({ to: "/games" }));
    }
  };

  // ===== Rematch =====
  const resetLocalGame = useCallback(() => {
    setState(Array.from({ length: max }, () => ({ tokens: [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }] })));
    setDice(null);
    setTurn(0);
    setRolling(false);
    setWaitingMove(false);
    setLog([]);
    setOver(null);
    startedAt.current = Date.now();
    finalizedRef.current = false;
  }, [max]);

  const onRematch = async () => {
    if (rematching) return;
    setRematching(true);
    try {
      if (!isMulti) {
        if (entry > 0) {
          nav({ to: "/play/$mode", params: { mode: "ludo" }, search: { entry, max } as any });
          return;
        }
        resetLocalGame();
        return;
      }
      if (!isHost || !userId) {
        toast.info(lang === "bn" ? "হোস্ট রিম্যাচ শুরু করতে পারে" : "Only host can start rematch");
        return;
      }
      const newCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: newRoom, error } = await supabase
        .from("game_rooms")
        .insert({
          code: newCode,
          mode: "ludo",
          host_id: userId,
          entry_fee: entry,
          prize_pool: prize,
          max_players: max,
          current_players: 0,
          status: "waiting",
        })
        .select()
        .single();
      if (error || !newRoom) throw error;
      const rows = seats.map((s) => ({
        room_id: newRoom.id,
        user_id: s.user_id,
        seat: s.seat,
        is_bot: s.is_bot,
      }));
      if (rows.length) await supabase.from("game_room_players").insert(rows);
      await supabase
        .from("game_rooms")
        .update({ current_players: rows.length })
        .eq("id", newRoom.id);
      channelRef.current?.send({
        type: "broadcast",
        event: "rematch",
        payload: { roomId: newRoom.id, fromName: lang === "bn" ? "হোস্ট" : "Host" },
      });
      toast.success(lang === "bn" ? "রিম্যাচ রুম তৈরি!" : "Rematch room created!");
      nav({ to: "/room/$roomId", params: { roomId: newRoom.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Rematch failed");
    } finally {
      setRematching(false);
    }
  };

  const acceptRematchInvite = () => {
    if (!rematchInvite) return;
    nav({ to: "/room/$roomId", params: { roomId: rematchInvite.roomId } });
  };

  const sendChat = (body: string, emoji = false) => {
    if (!body.trim() || mySeat === null) return;
    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seat: mySeat,
      name: playerNames[mySeat],
      body: body.slice(0, 140),
      ts: Date.now(),
      emoji,
    };
    setChatMsgs((prev) => [...prev, msg].slice(-50));
    chatChanRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
    setChatInput("");
  };

  const QUICK_EMOJIS = ["👍", "🔥", "😂", "😮", "🎯", "🏆", "💪", "👋"];

  // ===== Render =====
  const myTurnSeat = isMulti ? mySeat : 0;
  const movableTokens = waitingMove && dice != null && myTurnSeat !== null
    ? legalMoves(state, myTurnSeat, dice).map((ti) => ({ pi: myTurnSeat as number, ti }))
    : [];

  return (
    <div className="px-3 pt-4 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Room</div>
          <div className="font-mono text-xs">#{roomId.slice(-8)}</div>
        </div>
        <div className="flex items-center gap-2">
          <MuteToggle />
          <div className="flex items-center gap-1 text-sm font-bold text-primary">
            <Trophy className="h-4 w-4 text-yellow-500" />{c}{prize}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {playerNames.map((nm, i) => (
          <div
            key={i}
            className={`rounded-lg p-1.5 text-center border-2 transition-all ${turn === i ? `bg-card shadow-glow scale-105 animate-pulse` : "border-border/40 bg-card/50 opacity-60"}`}
            style={turn === i ? { borderColor: LUDO_PLAYERS[i].hex, boxShadow: `0 0 12px ${LUDO_PLAYERS[i].hex}` } : {}}
          >
            <div className="h-2 w-full rounded mb-1" style={{ backgroundColor: LUDO_PLAYERS[i].hex }} />
            <div className="text-[10px] font-medium truncate">{nm}</div>
            <div className="text-[9px] text-muted-foreground">
              {state[i].tokens.filter((t) => t.pos === 57).length}/4
            </div>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              {[0, 1, 2].map((d) => {
                const used = (misses[i] ?? 0) > d;
                return (
                  <span
                    key={d}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${used ? "bg-red-500" : "bg-green-500"}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <LudoBoard
        state={state}
        currentTurn={turn}
        highlightTokens={movableTokens}
        onTokenClick={onTokenClick}
        rotate={(((2 - (myTurnSeat ?? 0)) * 90) + 360) % 360}
      />

      <Card className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-14 w-14 rounded-xl bg-gradient-to-br from-white to-slate-200 border-2 flex items-center justify-center p-1.5 ${rolling ? "animate-spin" : ""}`}
            style={{
              borderColor: LUDO_PLAYERS[turn].hex,
              boxShadow: dice ? `0 0 14px ${LUDO_PLAYERS[turn].hex}aa, inset 0 -3px 6px rgba(0,0,0,0.15)` : "inset 0 -3px 6px rgba(0,0,0,0.15)",
            }}
          >
            {dice ? <DicePips value={dice} color="#0f172a" /> : <span className="text-2xl text-slate-400">?</span>}
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">{lang === "bn" ? "এখন" : "Turn"}</div>
            <div className="font-bold" style={{ color: LUDO_PLAYERS[turn].hex }}>{playerNames[turn]}</div>
            {waitingMove && (
              <div className="text-[10px] text-yellow-500 mt-0.5">
                {lang === "bn" ? "একটি টোকেন বাছুন" : "Pick a token"}
              </div>
            )}
            {isMulti && turnDeadline && !over && (
              <div className={`text-[10px] mt-0.5 font-mono ${countdown <= 5 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
                ⏱ {countdown}s
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={handlePlayerRoll}
          disabled={rolling || waitingMove || turn !== myTurnSeat || myTurnSeat === null || !!over}
          size="lg"
          className="shadow-glow"
        >
          <Dices className="h-5 w-5 mr-2" />
          {lang === "bn" ? "রোল" : "Roll"}
        </Button>
      </Card>

      <Card className="p-3 max-h-32 overflow-y-auto">
        <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">
          {lang === "bn" ? "কার্যকলাপ" : "Activity"}
        </div>
        {log.length === 0 ? (
          <div className="text-xs text-muted-foreground">{lang === "bn" ? "রোল করে শুরু করুন…" : "Roll to start…"}</div>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {log.map((l, i) => (<li key={i}>{l}</li>))}
          </ul>
        )}
      </Card>

      {over && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-6">
          {over === "won" && (
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => {
                const colors = ["#ef4444", "#22c55e", "#facc15", "#3b82f6", "#a78bfa", "#fb923c"];
                const left = Math.random() * 100;
                const delay = Math.random() * 0.8;
                const dur = 1.6 + Math.random() * 1.6;
                const size = 6 + Math.random() * 8;
                const color = colors[i % colors.length];
                return (
                  <span
                    key={i}
                    className="absolute top-[-20px] rounded-sm animate-confetti-fall"
                    style={{
                      left: `${left}%`,
                      width: size,
                      height: size * 1.4,
                      background: color,
                      animationDelay: `${delay}s`,
                      animationDuration: `${dur}s`,
                    }}
                  />
                );
              })}
            </div>
          )}
          <Card className="p-6 text-center max-w-sm w-full space-y-3">
            <div className={`text-6xl ${over === "won" ? "animate-bounce" : ""}`}>{over === "won" ? "🏆" : "😢"}</div>
            <h2 className="text-xl font-bold">
              {over === "won"
                ? (lang === "bn" ? "অভিনন্দন! আপনি জিতেছেন" : "You won!")
                : (lang === "bn" ? "আবার চেষ্টা করুন" : "You lost")}
            </h2>
            {over === "won" && <div className="text-2xl font-bold text-primary">+{c}{prize}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => nav({ to: "/games" })}>
                {lang === "bn" ? "গেমস" : "Games"}
              </Button>
              <Button
                className="flex-1 shadow-glow"
                onClick={onRematch}
                disabled={rematching || (isMulti && !isHost)}
              >
                {rematching
                  ? (lang === "bn" ? "অপেক্ষা..." : "Wait...")
                  : (lang === "bn" ? "🔄 রিম্যাচ" : "🔄 Rematch")}
              </Button>
            </div>
            {isMulti && !isHost && (
              <div className="text-[10px] text-muted-foreground">
                {lang === "bn" ? "হোস্ট রিম্যাচ শুরু করবে" : "Waiting for host to start rematch"}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => nav({ to: "/home" })}>
              {lang === "bn" ? "হোম" : "Home"}
            </Button>
          </Card>
        </div>
      )}

      {rematchInvite && !over && (
        <div className="fixed bottom-4 left-3 right-3 z-40">
          <Card className="p-3 flex items-center gap-3 border-primary shadow-glow bg-card/95 backdrop-blur">
            <div className="text-2xl">🔄</div>
            <div className="flex-1">
              <div className="text-sm font-bold">
                {lang === "bn" ? "রিম্যাচ আমন্ত্রণ" : "Rematch invite"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {rematchInvite.from} {lang === "bn" ? "আবার খেলতে চায়" : "wants to play again"}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRematchInvite(null)}>
              ✕
            </Button>
            <Button size="sm" onClick={acceptRematchInvite}>
              {lang === "bn" ? "যোগ দিন" : "Join"}
            </Button>
          </Card>
        </div>
      )}

      {/* Disconnect grace banners */}
      {isMulti && Object.entries(absentSeats).length > 0 && !over && (
        <div className="fixed top-2 left-3 right-3 z-40 space-y-1">
          {Object.entries(absentSeats).map(([sStr, since]) => {
            const s = Number(sStr);
            const left = Math.max(0, GRACE_SECONDS - Math.floor((Date.now() - since) / 1000));
            return (
              <Card key={s} className="px-3 py-2 flex items-center gap-2 border-destructive/40 bg-destructive/10 backdrop-blur">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <div className="text-xs flex-1">
                  <span className="font-bold">{playerNames[s]}</span>{" "}
                  {lang === "bn" ? "ডিসকানেক্টেড" : "disconnected"}
                </div>
                <div className={`text-xs font-mono font-bold ${left <= 5 ? "text-destructive" : "text-muted-foreground"}`}>
                  {left}s
                </div>
              </Card>
            );
          })}
          <span className="hidden">{graceTick}</span>
        </div>
      )}

      {/* Chat FAB */}
      {isMulti && !over && (
        <button
          onClick={() => { setChatOpen(true); setUnreadChat(0); }}
          className="fixed bottom-20 right-3 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadChat > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
              {unreadChat > 9 ? "9+" : unreadChat}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="w-full bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="font-bold text-sm">
                {lang === "bn" ? "রুম চ্যাট" : "Room Chat"}
              </div>
              <button onClick={() => setChatOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[180px]">
              {chatMsgs.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6">
                  {lang === "bn" ? "কোনো মেসেজ নেই — প্রথমে আপনি বলুন!" : "No messages yet — say hi!"}
                </div>
              ) : (
                chatMsgs.map((m) => {
                  const mine = m.seat === mySeat;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-1.5 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"} ${m.emoji ? "text-2xl" : "text-sm"}`}
                        style={!mine ? { borderLeft: `3px solid ${LUDO_PLAYERS[m.seat]?.hex ?? "#888"}` } : {}}
                      >
                        {!mine && <div className="text-[10px] opacity-70 mb-0.5">{m.name}</div>}
                        <div className="break-words">{m.body}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-3 py-2 border-t border-border flex gap-1 overflow-x-auto">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => sendChat(e, true)}
                  className="h-9 w-9 flex-shrink-0 rounded-full bg-muted hover:bg-muted/70 text-xl flex items-center justify-center"
                >
                  {e}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendChat(chatInput); }}
              className="px-3 pb-3 pt-1 flex gap-2"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value.slice(0, 140))}
                placeholder={lang === "bn" ? "মেসেজ লিখুন..." : "Type message..."}
                className="flex-1 rounded-full bg-background border border-border px-3 py-2 text-sm"
              />
              <Button type="submit" size="icon" disabled={!chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MuteToggle() {
  const [muted, setM] = useState(isMuted());
  return (
    <button
      onClick={() => { const n = !muted; setMuted(n); setM(n); if (!n) sfx.click(); }}
      className="p-1.5 rounded-md border border-border/40 bg-card/50 hover:bg-card transition"
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-primary" />}
    </button>
  );
}
