import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Copy, Crown, LogOut, Trophy, Users, Coins, Loader2, Bot, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/room/$roomId")({
  component: RoomLobbyPage,
});

type Room = {
  id: string;
  code: string;
  mode: string;
  host_id: string;
  entry_fee: number;
  prize_pool: number;
  max_players: number;
  current_players: number;
  status: string;
};

type Seat = {
  id: string;
  user_id: string;
  seat: number;
  is_bot: boolean;
  joined_at: string;
};

type ProfileLite = { id: string; username: string; game_id: string; avatar_url: string | null; level: number };

const SEAT_COLORS = ["bg-red-500", "bg-green-500", "bg-yellow-400", "bg-blue-500"];

const BOT_NAMES = [
  "Rahim", "Karim", "Sakib", "Tamim", "Mehedi", "Arif", "Niloy", "Rifat",
  "Sohag", "Jubayer", "Tanvir", "Imran", "Rakib", "Shakil", "Nayeem",
  "Shanto", "Ridoy", "Rasel", "Mizan", "Hasib", "Sumon", "Jewel",
  "Robin", "Pavel", "Apon", "Shimul", "Shamim", "Kabir", "Faruk", "Jamal",
  "Sajid", "Tareq", "Liton", "Masud", "Nahid", "Polash", "Rajib", "Saiful",
  "Tuhin", "Wasim", "Zahid", "Anik", "Bappi", "Dipu", "Emon", "Forhad",
  "Galib", "Hridoy", "Ifty", "Joy",
];

function botIdentity(seatKey: string) {
  let h = 0;
  for (let i = 0; i < seatKey.length; i++) h = (h * 31 + seatKey.charCodeAt(i)) >>> 0;
  const name = BOT_NAMES[h % BOT_NAMES.length];
  const suffix = (h % 9000) + 1000;
  const level = (h % 12) + 1;
  return { username: `${name}${suffix}`, level };
}

function RoomLobbyPage() {
  const { roomId } = useParams({ from: "/_authenticated/room/$roomId" });
  const { lang } = useI18n();
  const c = useCurrency();
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [players, setPlayers] = useState<Record<string, ProfileLite>>({});
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const isHost = room && userId && room.host_id === userId;
  const seatsFilled = seats.length;
  const isFull = room ? seatsFilled >= room.max_players : false;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load room + seats
  const loadAll = async () => {
    const { data: r } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();
    if (!r) {
      toast.error(lang === "bn" ? "রুম পাওয়া যায়নি" : "Room not found");
      nav({ to: "/games" });
      return;
    }
    setRoom(r as Room);
    const { data: s } = await supabase
      .from("game_room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat", { ascending: true });
    setSeats((s ?? []) as Seat[]);
    // Load profile info for human players
    const userIds = (s ?? []).filter((x: any) => !x.is_bot).map((x: any) => x.user_id);
    if (userIds.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, game_id, avatar_url, level")
        .in("id", userIds);
      const map: Record<string, ProfileLite> = {};
      (p ?? []).forEach((x: any) => { map[x.id] = x; });
      setPlayers(map);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [roomId]);

  // Realtime: subscribe to seat + room changes + presence
  useEffect(() => {
    if (!userId || !room) return;
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("postgres_changes",
        { event: "*", schema: "public", table: "game_room_players", filter: `room_id=eq.${roomId}` },
        () => loadAll())
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          if (updated.status === "playing") {
            nav({
              to: "/board/$roomId",
              params: { roomId: updated.id },
              search: { entry: updated.entry_fee, prize: updated.prize_pool, max: updated.max_players } as any,
            });
          }
        })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [userId, room?.id, roomId]);

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    toast.success(lang === "bn" ? "কোড কপি হয়েছে" : "Code copied");
  };

  const leave = async () => {
    if (!userId || !room) return;
    await supabase.from("game_room_players").delete()
      .eq("room_id", room.id).eq("user_id", userId);
    if (isHost) {
      // Host leaving — cancel room
      await supabase.from("game_rooms").update({ status: "cancelled" }).eq("id", room.id);
    } else {
      await supabase.from("game_rooms")
        .update({ current_players: Math.max(0, room.current_players - 1) })
        .eq("id", room.id);
    }
    nav({ to: "/games" });
  };

  const addBot = async () => {
    if (!isHost || !room || isFull) return;
    const { error } = await supabase.rpc("add_bot_to_room", { _room_id: room.id });
    if (error) { toast.error(error.message); return; }
  };

  const start = async () => {
    if (!isHost || !room) return;
    if (seatsFilled < 2) {
      toast.error(lang === "bn" ? "কমপক্ষে ২ জন প্লেয়ার দরকার" : "Need at least 2 players");
      return;
    }
    setStarting(true);
    const { error } = await supabase.from("game_rooms")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", room.id);
    setStarting(false);
    if (error) { toast.error(error.message); return; }
    // Realtime UPDATE handler will navigate everyone to /board
  };

  const seatList = useMemo(() => {
    if (!room) return [];
    return Array.from({ length: room.max_players }).map((_, i) => {
      const seat = seats.find((s) => s.seat === i);
      return { idx: i, seat };
    });
  }, [room, seats]);

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={leave} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold capitalize">{room.mode} {lang === "bn" ? "লুডু" : "Ludo"}</h1>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <Users className="h-3 w-3" /> {seatsFilled}/{room.max_players}
            <span className="text-primary">●</span>
            <span>{online.size} {lang === "bn" ? "অনলাইন" : "online"}</span>
          </div>
        </div>
      </div>

      {/* Stakes */}
      <Card className="p-3 bg-gradient-to-br from-primary/15 to-accent/10 border-primary/30 flex items-center justify-around">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">{lang === "bn" ? "এন্ট্রি" : "Entry"}</div>
          <div className="text-sm font-bold flex items-center gap-1"><Coins className="h-3 w-3" />{c}{room.entry_fee}</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">{lang === "bn" ? "প্রাইজ" : "Prize"}</div>
          <div className="text-sm font-bold text-primary flex items-center gap-1"><Trophy className="h-3 w-3" />{c}{room.prize_pool}</div>
        </div>
      </Card>

      {/* Room code */}
      <button
        onClick={copyCode}
        className="w-full p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 flex items-center justify-between"
      >
        <div className="text-left">
          <div className="text-[10px] text-muted-foreground">{lang === "bn" ? "রুম কোড" : "Room Code"}</div>
          <div className="font-mono font-bold tracking-[0.25em] text-primary text-lg">{room.code}</div>
        </div>
        <Copy className="h-4 w-4 text-primary" />
      </button>

      {/* Seats */}
      <div className="grid grid-cols-2 gap-3">
        {seatList.map(({ idx, seat }) => {
          const profile = seat && !seat.is_bot ? players[seat.user_id] : null;
          const isOnline = seat && !seat.is_bot && online.has(seat.user_id);
          const isMe = seat && !seat.is_bot && seat.user_id === userId;
          return (
            <Card
              key={idx}
              className={`p-3 flex flex-col items-center gap-2 relative ${seat ? "border-primary/30" : "border-dashed opacity-60"}`}
            >
              <div className={`absolute top-1 left-1 h-3 w-3 rounded-full ${SEAT_COLORS[idx]}`} />
              {seat && room.host_id === seat.user_id && !seat.is_bot && (
                <Crown className="absolute top-1 right-1 h-3 w-3 text-yellow-500" />
              )}
              {seat ? (
                seat.is_bot ? (() => {
                  const bot = botIdentity(seat.id);
                  return (
                    <>
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-sm font-bold">
                          {bot.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                      </div>
                      <div className="text-xs font-semibold truncate max-w-[100px]">{bot.username}</div>
                      <div className="text-[10px] text-muted-foreground">Lv.{bot.level}</div>
                    </>
                  );
                })() : (
                  <>
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-sm font-bold overflow-hidden">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (profile?.username ?? "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${isOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                    </div>
                    <div className="text-xs font-semibold truncate max-w-[100px]">
                      {profile?.username ?? "..."}
                      {isMe && <span className="text-primary"> ({lang === "bn" ? "আপনি" : "You"})</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Lv.{profile?.level ?? 1}</div>
                  </>
                )
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lang === "bn" ? "অপেক্ষা..." : "Waiting..."}
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Host controls */}
      {isHost && !isFull && (
        <Button variant="outline" className="w-full" onClick={addBot}>
          <Plus className="h-4 w-4 mr-2" /> {lang === "bn" ? "প্লেয়ার যোগ করুন" : "Add Player"}
        </Button>
      )}

      {isHost ? (
        <Button className="w-full" disabled={starting || seatsFilled < 2} onClick={start}>
          {starting
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {lang === "bn" ? "শুরু হচ্ছে..." : "Starting..."}</>
            : (lang === "bn" ? "খেলা শুরু" : "Start Game")}
        </Button>
      ) : (
        <div className="text-center text-xs text-muted-foreground py-2 flex items-center justify-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {lang === "bn" ? "হোস্ট খেলা শুরু করার অপেক্ষায়..." : "Waiting for host to start..."}
        </div>
      )}

      <Button variant="ghost" className="w-full text-destructive" onClick={leave}>
        <LogOut className="h-4 w-4 mr-2" /> {lang === "bn" ? "রুম ছাড়ুন" : "Leave Room"}
      </Button>
    </div>
  );
}