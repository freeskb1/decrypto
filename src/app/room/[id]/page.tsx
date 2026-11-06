"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ensureAnonymousAuth,
  subscribeRoom,
  subscribePlayers,
  updateHeartbeat,
  joinRoomById,
  ensureHubRoom,
  joinHubRoom,
} from "@/lib/game";
import { readHubParams, hubRoomId, type HubParams } from "@/lib/hub";
import type { Room, Player } from "@/types/game";
import WaitingRoom from "@/components/game/WaitingRoom";
import TeamSetup from "@/components/game/TeamSetup";
import RulesIntro from "@/components/game/RulesIntro";
import KeywordReveal from "@/components/game/KeywordReveal";
import RoundPlay from "@/components/game/RoundPlay";
import EndedScreen from "@/components/game/EndedScreen";
import TiebreakScreen from "@/components/game/TiebreakScreen";
import { Screen } from "@/components/game/ui";
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

  // 말랑월드 자동 입장 상태
  const [hub, setHub] = useState<HubParams | null>(null);
  const [hubChecked, setHubChecked] = useState(false);
  const [hubHostDone, setHubHostDone] = useState(false);
  const [hubError, setHubError] = useState("");
  const hubHostRef = useRef<string | null>(null);
  const hubJoinRef = useRef<string | null>(null);

  // 말랑월드 쿼리 읽기 (이 방 키와 맞을 때만 적용 → 쿼리가 없으면 기존 흐름 그대로)
  useEffect(() => {
    const h = readHubParams(window.location.search);
    if (h && hubRoomId(h.room) === roomId) {
      const saved = localStorage.getItem("nickname");
      const name = h.name || saved || "플레이어";
      localStorage.setItem("nickname", name);
      setHub({ ...h, name });
    }
    setHubChecked(true);
  }, [roomId]);

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
  // (익명 로그인이 끝난 뒤에 구독 — DB 규칙이 auth != null이라 로그인 전 구독은 거절되어 멈출 수 있음)
  useEffect(() => {
    if (!roomId || !myUid) return;
    const unsub1 = subscribeRoom(roomId, (r) => {
      setRoom(r);
      setLoaded(true);
    });
    const unsub2 = subscribePlayers(roomId, (p) => setPlayers(p));
    return () => {
      unsub1();
      unsub2();
    };
  }, [roomId, myUid]);

  // 하트비트 (방에 참가한 경우만)
  // players가 바뀔 때마다 다시 쓰면 내 쓰기 → players 변경 → 다시 쓰기가 반복되므로 "참가 여부"에만 반응
  const meInRoom = !!myUid && players.some((p) => p.uid === myUid);
  useEffect(() => {
    if (!roomId || !myUid || !meInRoom) return;
    const interval = setInterval(() => {
      updateHeartbeat(roomId, myUid);
    }, 15000);
    updateHeartbeat(roomId, myUid);
    return () => clearInterval(interval);
  }, [roomId, myUid, meInRoom]);

  // 말랑월드 방장: h{room} 방을 이번 판(sid)으로 만들기 (멱등 트랜잭션)
  // 모두 같은 방에서 각자 폰으로 (채팅 없음, 말로 의논). 예전 판에서 본 키워드는 이어받음
  useEffect(() => {
    if (!hub || !hub.host || !myUid) return;
    const key = `${hub.sid}:${myUid}`;
    if (hubHostRef.current === key) return;
    hubHostRef.current = key;
    (async () => {
      try {
        await ensureHubRoom({
          roomId,
          hubRoom: hub.room,
          sid: hub.sid,
          uid: myUid,
          nickname: hub.name,
          hubUid: hub.uid,
        });
        localStorage.setItem(`room:${roomId}`, "1");
        setHubHostDone(true);
      } catch (e: any) {
        hubHostRef.current = null;
        setHubError(e?.message || "방 만들기 실패");
      }
    })();
  }, [hub, myUid, roomId]);

  // 멤버가 받은 sid가 방 sid와 달라도(새로고침해서 예전 주소, 같은 브라우저 탭, 말랑월드에서 다시 시작 등)
  // 그 말랑월드 방(h{번호})이 아직 대기실이면 그 판으로 들어간다. 이미 들어가 있는 방이면 그대로 보여준다.
  // 방 키가 말랑월드 방 번호라서 대기실이면 지금 판이 맞다 (예전 판이 끝난 방은 대기실이 아님)
  const hubMatches =
    !!hub &&
    !!room &&
    (room.hubSid === hub.sid ||
      (!hub.host && !!room.hubSid && (room.phase === "waiting" || meInRoom)));
  const roomSid = hubMatches && room ? room.hubSid || "" : "";
  // 진단용 (테스트 중 문제 찾기): 방 키 · 내 판 · 방 판 · 방 상태 · 인원 · 나 들어감 여부 · 배포 버전
  const hubDebug = hub
    ? `${roomId} · 내 판 ${hub.sid.slice(-5)} · 방 판 ${room?.hubSid ? room.hubSid.slice(-5) : "없음"} · ${
        room?.phase || "방 없음"
      } · ${players.length}명 · ${meInRoom ? "입장함" : "미입장"}${hub.host ? " · 방장" : ""} · v3`
    : "";

  // 말랑월드 멤버(및 방장 예외 상황): 이번 판 방이 생기면 자동 입장 (이미 있으면 건너뜀)
  useEffect(() => {
    if (!hub || !myUid || !room) return;
    if (hub.host && !hubHostDone) return;
    if (!hubMatches) return; // 방장을 기다리는 중
    if (meInRoom || room.phase !== "waiting") return;
    const key = `${roomSid}:${myUid}`;
    if (hubJoinRef.current === key) return;
    hubJoinRef.current = key;
    (async () => {
      try {
        await joinHubRoom({
          roomId,
          sid: roomSid,
          uid: myUid,
          nickname: hub.name,
          hubUid: hub.uid,
        });
        localStorage.setItem(`room:${roomId}`, "1");
        setHubError("");
      } catch (e: any) {
        hubJoinRef.current = null; // 다음 방 변경 때 다시 시도
        setHubError(e?.message || "입장 실패");
      }
    })();
  }, [hub, myUid, room, meInRoom, hubHostDone, roomId, hubMatches, roomSid]);

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
  if (!loaded || !myUid || !hubChecked) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center text-muted text-sm">불러오는 중...</div>
      </Screen>
    );
  }

  // 말랑월드: 이번 판 방이 아직 없음 (방장은 만드는 중, 멤버는 기다리는 중)
  if (hub && (!room || !hubMatches)) {
    return (
      <HubWait
        text={hub.host ? "방 만드는 중..." : "방장을 기다리는 중…"}
        error={hubError}
        debug={hubDebug}
      />
    );
  }

  // 방이 존재하지 않음
  if (!room) {
    return (
      <Notice title="방을 찾을 수 없어요" desc="방이 사라졌거나 잘못된 링크예요">
        <Button className="w-full" onClick={() => router.push("/")}>
          메인으로
        </Button>
      </Notice>
    );
  }

  const me = players.find((p) => p.uid === myUid);

  // 아직 이 방에 참가하지 않음 → 닉네임 입력 + 참가 화면
  if (!me) {
    // 말랑월드: 닉네임 입력 없이 자동 입장 중
    if (hub && room.phase === "waiting") {
      return <HubWait text="입장 중..." error={hubError} debug={hubDebug} />;
    }

    // 이미 시작된 게임에는 참가 불가
    if (room.phase !== "waiting") {
      return (
        <Notice title="이미 시작된 게임이에요" desc="게임이 진행 중이라 참가할 수 없어요">
          <Button className="w-full" onClick={() => router.push("/")}>
            메인으로
          </Button>
        </Notice>
      );
    }

    return (
      <Notice title="방에 참가하기" desc="">
        <div className="bg-paper rounded-xl p-3 mb-4 text-center">
          <div className="text-[11px] tracking-[0.2em] font-bold text-muted mb-0.5">방 코드</div>
          <div className="font-mono font-bold text-[24px] tracking-[0.2em]">{room.code}</div>
        </div>
        <label className="block text-[13px] font-bold text-muted mb-1.5 text-left">닉네임</label>
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
        <Button className="w-full" size="lg" onClick={handleJoin} disabled={joining}>
          {joining ? "참가 중..." : "참가하기"}
        </Button>
        <button
          className="w-full text-center text-xs text-muted mt-3 py-2"
          onClick={() => router.push("/")}
        >
          메인으로 돌아가기
        </button>
      </Notice>
    );
  }

  // 정상 - phase별 화면
  switch (room.phase) {
    case "waiting":
      return (
        <>
          <WaitingRoom room={room} players={players} me={me} />
          {hubDebug && (
            <div className="fixed bottom-1 left-2 text-[10px] text-muted font-mono pointer-events-none">
              {hubDebug}
              {hubError ? ` · 오류: ${hubError}` : ""}
            </div>
          )}
        </>
      );
    case "team_setup":
      return <TeamSetup room={room} players={players} me={me} />;
    case "rules":
      return <RulesIntro room={room} players={players} me={me} />;
    case "keyword_reveal":
      return <KeywordReveal room={room} players={players} me={me} />;
    case "round_in_progress":
      return <RoundPlay room={room} players={players} me={me} />;
    case "tiebreak":
      return <TiebreakScreen room={room} players={players} me={me} />;
    case "ended":
      return <EndedScreen room={room} players={players} me={me} />;
    default:
      return (
        <Notice title="알 수 없는 상태" desc="새로고침해 주세요">
          <Button className="w-full" onClick={() => window.location.reload()}>
            새로고침
          </Button>
        </Notice>
      );
  }
}

// 가운데 카드 하나짜리 안내 화면
function Notice({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <Screen>
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full bg-white border-[1.5px] border-line rounded-[20px] p-6 text-center">
          <div className="font-mono font-bold text-[13px] tracking-[0.3em] text-muted mb-2">DECRYPTO</div>
          <div className="font-serif font-black text-[22px] mb-1.5">{title}</div>
          {desc && <div className="text-[13px] text-muted mb-4">{desc}</div>}
          {children}
        </div>
      </div>
    </Screen>
  );
}

// 말랑월드 자동 입장 대기 화면
function HubWait({ text, error, debug }: { text: string; error: string; debug?: string }) {
  return (
    <Notice title={text} desc="">
      {debug && <div className="text-[11px] text-muted font-mono mt-1 break-all">{debug}</div>}
      {error && (
        <>
          <div className="text-[13px] font-bold text-stamp mt-1">{error}</div>
          <Button className="w-full mt-4" variant="outline" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </>
      )}
    </Notice>
  );
}
