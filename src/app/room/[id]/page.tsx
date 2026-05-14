"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ensureAnonymousAuth,
  subscribeRoom,
  subscribePlayers,
  updateHeartbeat,
  joinRoomById,
} from "@/lib/game";
import type { Room, Player } from "@/types/game";
import WaitingRoom from "@/components/game/WaitingRoom";
import TeamSetup from "@/components/game/TeamSetup";
import RulesIntro from "@/components/game/RulesIntro";
import KeywordReveal from "@/components/game/KeywordReveal";
import RoundPlay from "@/components/game/RoundPlay";
import EndedScreen from "@/components/game/EndedScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myUid, setMyUid] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);

  // 익명 인증
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

  // 저장된 닉네임 복원
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("nickname") : null;
    if (saved) setNickname(saved);
  }, []);

  // 방 + 플레이어 구독
  useEffect(() => {
    if (!roomId) return;
    const unsub1 = subscribeRoom(roomId, (r) => {
      setRoom(r);
      setLoaded(true);
    });
    const unsub2 = subscribePlayers(roomId, (p) => setPlayers(p));
    return () => {
      unsub1();
      unsub2();
    };
  }, [roomId]);

  // 하트비트
  useEffect(() => {
    if (!roomId || !myUid) return;
    const me = players.find((p) => p.uid === myUid);
    if (!me) return; // 방에 참가한 경우만
    const interval = setInterval(() => {
      updateHeartbeat(roomId, myUid);
    }, 15000);
    updateHeartbeat(roomId, myUid);
    return () => clearInterval(interval);
  }, [roomId, myUid, players]);

  const handleJoin = async () => {
    if (!nickname.trim()) {
      toast.show("닉네임을 입력해주세요", "error");
      return;
    }
    setJoining(true);
    try {
      localStorage.setItem("nickname", nickname.trim());
      localStorage.setItem(`room:${roomId}`, "1");
      await joinRoomById(roomId, myUid, nickname.trim());
      // 참가 후 players 구독이 자동으로 갱신됨
    } catch (e: any) {
      toast.show(e.message || "참가 실패", "error");
      setJoining(false);
    }
  };

  // 로딩 중
  if (!loaded || !myUid) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  // 방이 존재하지 않음
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="text-base font-medium mb-1.5">방을 찾을 수 없어요</div>
          <div className="text-xs text-zinc-500 mb-4">
            방이 사라졌거나 잘못된 링크예요
          </div>
          <Button className="w-full" onClick={() => router.push("/")}>
            메인으로
          </Button>
        </div>
      </div>
    );
  }

  const me = players.find((p) => p.uid === myUid);

  // 아직 이 방에 참가하지 않음 → 닉네임 입력 + 참가 화면
  if (!me) {
    // 이미 시작된 게임에는 참가 불가
    if (room.phase !== "waiting") {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
          <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm text-center">
            <div className="text-base font-medium mb-1.5">
              이미 시작된 게임이에요
            </div>
            <div className="text-xs text-zinc-500 mb-4">
              게임이 진행 중이라 참가할 수 없어요
            </div>
            <Button className="w-full" onClick={() => router.push("/")}>
              메인으로
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <div className="text-center mb-5">
            <div className="font-mono text-[22px] font-medium tracking-[0.15em]">
              DECRYPTO
            </div>
            <div className="text-[13px] text-zinc-500 mt-1">방에 참가하기</div>
          </div>

          <div className="bg-zinc-50 rounded-lg p-3 mb-4 text-center">
            <div className="text-[11px] text-zinc-500 mb-0.5">방 코드</div>
            <div className="font-mono text-[20px] font-medium tracking-[0.2em]">
              {room.code}
            </div>
          </div>

          <label className="block text-[13px] text-zinc-600 mb-1.5">닉네임</label>
          <Input
            placeholder="이름을 입력하세요"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            selectOnFocus
            className="mb-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />

          <Button
            className="w-full"
            size="lg"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? "참가 중..." : "참가하기"}
          </Button>

          <button
            className="w-full text-center text-xs text-zinc-400 mt-3 py-2"
            onClick={() => router.push("/")}
          >
            메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 정상 - phase별 화면
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
