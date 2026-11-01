"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { subscribeTeam, rematchSameTeams } from "@/lib/game";
import { hubReturnUrl, goToHub } from "@/lib/hub";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { cn, formatScore } from "@/lib/utils";
import { Screen, StatusBar, KeywordGrid } from "./ui";
import NoteSheet from "./NoteSheet";

export default function EndedScreen({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const [white, setWhite] = useState<TeamState | null>(null);
  const [black, setBlack] = useState<TeamState | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasHub, setHasHub] = useState(false);

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  useEffect(() => {
    setHasHub(!!room.hubSid || hubReturnUrl(false) !== null);
  }, [room.hubSid]);

  if (!white || !black || !me?.team) {
    return (
      <Screen>
        <div className="p-6 text-sm text-muted">불러오는 중...</div>
      </Screen>
    );
  }

  const myTeamId: TeamId = me.team;
  const isDraw = room.winner === "draw";
  const winnerTeam = room.winner === "white" ? white : room.winner === "black" ? black : null;
  const myWon = room.winner === myTeamId;
  const stamp = isDraw ? "공동 승리" : winnerTeam ? `${winnerTeam.name} 승리` : "게임 끝";
  const score = (t: TeamState) => t.interceptionTokens - t.miscommunicationTokens;
  const tb = room.tiebreak;

  const handleRematch = async () => {
    setBusy(true);
    try {
      await rematchSameTeams(room.id);
    } catch (e: any) {
      toast.show(e?.message || "다시 하기 실패", "error");
    }
    setBusy(false);
  };

  const handleHub = () => {
    if (hubReturnUrl(me.isHost)) {
      goToHub(me.isHost);
    } else {
      toast.show("말랑월드 주소를 찾지 못했어요", "error");
    }
  };

  return (
    <Screen>
      <StatusBar
        roundLabel={`R${room.roundNumber} 종료`}
        white={white}
        black={black}
        onOpenNotes={() => setShowNotes(true)}
      />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <div className="relative bg-white border-2 border-ink rounded-[20px] px-4 py-[18px] text-center mt-2">
          <span className="stamp-mark absolute -right-1.5 -top-3.5 border-[3px] border-stamp text-stamp rounded-lg px-2.5 py-1 font-serif font-black text-[15px] bg-white/85">
            {stamp}
          </span>
          <div className="text-[11px] tracking-[0.2em] font-bold text-muted">끝난 이유</div>
          <div className="font-serif font-black text-[21px] leading-snug mt-2 mb-1">
            {room.endReason || "게임이 끝났어요"}
          </div>
          <div className="text-[13px] text-muted mb-3">
            {isDraw ? "두 팀 모두 잘했어요" : myWon ? "우리 팀이 이겼어요!" : "아쉬워요. 다음 판에 다시!"}
          </div>
          <div className="flex flex-col gap-1.5 text-left">
            {(["white", "black"] as TeamId[]).map((t) => {
              const team = t === "white" ? white : black;
              const lost = !isDraw && room.winner !== null && room.winner !== t;
              return (
                <div
                  key={t}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold",
                    lost ? "bg-got text-stamp" : "bg-paper text-ok"
                  )}
                >
                  <span className="min-w-0">
                    {team.name} · 가로채기 {team.interceptionTokens} · 해독 실패 {team.miscommunicationTokens}
                  </span>
                  <span className="ml-auto font-mono">{formatScore(score(team))}</span>
                </div>
              );
            })}
          </div>
        </div>

        {tb && (tb.white || tb.black) && (
          <div className="bg-white border-[1.5px] border-line rounded-2xl px-3 py-2.5 text-xs">
            <b className="font-bold">상대 키워드 맞히기</b>
            {(["white", "black"] as TeamId[]).map((t) => {
              const g = t === "white" ? tb.white : tb.black;
              const team = t === "white" ? white : black;
              return (
                <div key={t} className="mt-1">
                  <span className="font-bold">{team.name}</span>
                  <span className="text-muted"> · {g ? g.join(", ") : "—"}</span>
                </div>
              );
            })}
          </div>
        )}

        {(["white", "black"] as TeamId[]).map((t) => {
          const team = t === "white" ? white : black;
          return (
            <div key={t}>
              <div className="text-xs font-bold text-muted mb-1.5 px-1">{team.name} 키워드</div>
              <KeywordGrid keywords={team.keywords} teamId={t} />
            </div>
          );
        })}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button size="lg" className="w-full" onClick={handleRematch} disabled={busy}>
            같은 팀으로 다시 하기
          </Button>
          {hasHub ? (
            <Button size="lg" variant="outline" className="w-full" onClick={handleHub}>
              말랑월드로
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="w-full" onClick={() => router.push("/")}>
              처음 화면으로
            </Button>
          )}
          <p className="text-xs text-muted text-center">
            다시 하면 새 키워드로 시작해요 (이 모임에서 나온 키워드는 다시 안 나와요)
          </p>
        </div>
      </div>

      {showNotes && (
        <NoteSheet
          room={room}
          white={white}
          black={black}
          myTeamId={myTeamId}
          reveal
          onClose={() => setShowNotes(false)}
        />
      )}
    </Screen>
  );
}
