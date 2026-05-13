"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonymousAuth, subscribeRoom, subscribePlayers, updateHeartbeat } from "@/lib/game";
import type { Room, Player } from "@/types/game";
import WaitingRoom from "@/components/game/WaitingRoom";
import TeamSetup from "@/components/game/TeamSetup";
import RulesIntro from "@/components/game/RulesIntro";
import KeywordReveal from "@/components/game/KeywordReveal";
import RoundPlay from "@/components/game/RoundPlay";
import EndedScreen from "@/components/game/EndedScreen";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myUid, setMyUid] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await ensureAnonymousAuth();
        setMyUid(user.uid);
      } catch (e) {
        router.push("/");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!roomId) return;
    const unsub1 = subscribeRoom(roomId, (r) => {
      if (!r) {
        router.push("/");
        return;
      }
      setRoom(r);
      setLoaded(true);
    });
    const unsub2 = subscribePlayers(roomId, (p) => setPlayers(p));
    return () => {
      unsub1();
      unsub2();
    };
  }, [roomId, router]);

  // 하트비트
  useEffect(() => {
    if (!roomId || !myUid) return;
    const interval = setInterval(() => {
      updateHeartbeat(roomId, myUid);
    }, 15000);
    updateHeartbeat(roomId, myUid);
    return () => clearInterval(interval);
  }, [roomId, myUid]);

  if (!loaded || !room || !myUid) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  const me = players.find((p) => p.uid === myUid);

  switch (room.phase) {
    case "waiting":
      return <WaitingRoom room={room} players={players} me={me} />;
    case "team_setup":
      return <TeamSetup room={room} players={players} me={me} />;
    case "rules":
      return <RulesIntro room={room} me={me} />;
    case "keyword_reveal":
      return <KeywordReveal room={room} players={players} me={me} />;
    case "round_in_progress":
      return <RoundPlay room={room} players={players} me={me} />;
    case "ended":
      return <EndedScreen room={room} players={players} me={me} />;
    default:
      return <div>알 수 없는 상태</div>;
  }
}
