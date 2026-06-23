import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Copy, Users, Coins, Share2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play-friend")({
  component: PlayFriendPage,
});

const MODES = [
  { id: "classic", name: { bn: "ক্লাসিক", en: "Classic" }, players: 4 },
  { id: "speed",   name: { bn: "স্পিড",   en: "Speed"   }, players: 2 },
  { id: "quick",   name: { bn: "কুইক",    en: "Quick"   }, players: 2 },
];

const ENTRIES = [10, 20, 50, 100, 250, 500];


function PlayFriendPage() {
  const { lang } = useI18n();
  const c = useCurrency();
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState("classic");
  const [entry, setEntry] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState<2 | 4>(4);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [createdRoom, setCreatedRoom] = useState<{ id: string; code: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const create = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_friend_room" as any, {
        _mode: mode,
        _entry_fee: entry,
        _max_players: maxPlayers,
      });
      if (error) throw error;
      const res = data as { ok: boolean; room_id?: string; code?: string; error?: string };
      if (!res?.ok || !res.room_id || !res.code) {
        toast.error(
          res?.error === "insufficient_balance"
            ? (lang === "bn" ? "ব্যালেন্স কম" : "Insufficient balance")
            : (res?.error ?? "Failed"),
        );
        return;
      }
      setCreatedRoom({ id: res.room_id, code: res.code });
      toast.success(lang === "bn" ? "রুম তৈরি হয়েছে!" : "Room created!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const join = async () => {
    if (!userId) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast.error(lang === "bn" ? "সঠিক কোড দিন" : "Enter a valid code");
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("join_friend_room" as any, { _code: c });
      if (error) throw error;
      const res = data as { ok: boolean; room_id?: string; error?: string };
      if (!res?.ok || !res.room_id) {
        const msg =
          res?.error === "insufficient_balance" ? (lang === "bn" ? "ব্যালেন্স কম" : "Insufficient balance") :
          res?.error === "not_found" ? (lang === "bn" ? "রুম পাওয়া যায়নি" : "Room not found") :
          res?.error === "room_full" ? (lang === "bn" ? "রুম পূর্ণ" : "Room is full") :
          res?.error === "not_joinable" ? (lang === "bn" ? "এই রুমে যোগ দেওয়া যাবে না" : "Cannot join this room") :
          (res?.error ?? "Failed");
        toast.error(msg);
        return;
      }
      nav({ to: "/room/$roomId", params: { roomId: res.room_id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const copyCode = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.code);
    toast.success(lang === "bn" ? "কপি হয়েছে" : "Copied");
  };

  const shareCode = async () => {
    if (!createdRoom) return;
    const text = lang === "bn"
      ? `আমার সাথে লুডু খেলো! রুম কোড: ${createdRoom.code}`
      : `Play Ludo with me! Room code: ${createdRoom.code}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success(lang === "bn" ? "শেয়ার টেক্সট কপি হয়েছে" : "Share text copied");
    }
  };

  const enterRoom = () => {
    if (!createdRoom) return;
    nav({ to: "/room/$roomId", params: { roomId: createdRoom.id } });
  };

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/games" })} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {lang === "bn" ? "বন্ধুর সাথে খেলুন" : "Play with Friend"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn" ? "প্রাইভেট রুম তৈরি করুন বা কোড দিয়ে যোগ দিন" : "Create a private room or join by code"}
          </p>
        </div>
      </div>

      {createdRoom ? (
        <Card className="p-5 bg-gradient-to-br from-primary/15 to-accent/10 border-primary/30 space-y-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">
              {lang === "bn" ? "রুম কোড" : "Room Code"}
            </div>
            <div className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">
              {createdRoom.code}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={copyCode}>
              <Copy className="h-4 w-4 mr-1" /> {lang === "bn" ? "কপি" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={shareCode}>
              <Share2 className="h-4 w-4 mr-1" /> {lang === "bn" ? "শেয়ার" : "Share"}
            </Button>
          </div>
          <Button className="w-full" onClick={enterRoom}>
            {lang === "bn" ? "রুমে প্রবেশ করুন" : "Enter Room"}
          </Button>
          <button
            onClick={() => setCreatedRoom(null)}
            className="w-full text-xs text-muted-foreground underline"
          >
            {lang === "bn" ? "নতুন রুম তৈরি করুন" : "Create another room"}
          </button>
        </Card>
      ) : (
        <Tabs defaultValue="create">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="create">{lang === "bn" ? "তৈরি করুন" : "Create"}</TabsTrigger>
            <TabsTrigger value="join">{lang === "bn" ? "যোগ দিন" : "Join"}</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <Card className="p-4 space-y-4">
              <div>
                <Label className="text-xs mb-2 block">{lang === "bn" ? "মোড" : "Mode"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); setMaxPlayers(m.players as 2 | 4); }}
                      className={`p-2 rounded-lg border text-xs font-semibold transition ${mode === m.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      {(m.name as any)[lang] ?? m.name.en}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">{lang === "bn" ? "প্লেয়ার সংখ্যা" : "Players"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[2, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxPlayers(n as 2 | 4)}
                      className={`p-2 rounded-lg border flex items-center justify-center gap-1 text-sm font-semibold transition ${maxPlayers === n ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      <Users className="h-4 w-4" /> {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">{lang === "bn" ? "এন্ট্রি ফি" : "Entry Fee"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ENTRIES.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEntry(e)}
                      className={`p-2 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition ${entry === e ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      <Coins className="h-3 w-3" /> {c}{e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                {lang === "bn" ? "জিতলে পাবেন" : "Winner gets"}{" "}
                <span className="text-primary font-bold">{c}{Math.floor(entry * maxPlayers * 0.9)}</span>
              </div>

              <Button className="w-full" disabled={creating} onClick={create}>
                {creating ? (lang === "bn" ? "তৈরি হচ্ছে..." : "Creating...") : (lang === "bn" ? "রুম তৈরি করুন" : "Create Room")}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="join" className="space-y-4 mt-4">
            <Card className="p-4 space-y-4">
              <div>
                <Label className="text-xs mb-2 block flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> {lang === "bn" ? "রুম কোড" : "Room Code"}
                </Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="ABC123"
                  className="text-center text-xl font-mono tracking-[0.3em] uppercase h-14"
                  maxLength={8}
                />
              </div>
              <Button className="w-full" disabled={joining || code.length < 4} onClick={join}>
                {joining ? (lang === "bn" ? "যোগ হচ্ছে..." : "Joining...") : (lang === "bn" ? "রুমে যোগ দিন" : "Join Room")}
              </Button>
            </Card>

            <div className="text-[11px] text-muted-foreground text-center">
              {lang === "bn"
                ? "* বন্ধুর কাছ থেকে রুম কোড নিন এবং উপরে লিখুন।"
                : "* Get the room code from your friend and enter it above."}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}