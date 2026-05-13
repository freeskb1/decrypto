"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { advanceStage } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";

export default function StageAnnounce({
  room,
  round,
  myTeam,
  otherTeam,
  myTeamId,
  players,
  me,
}: {
  room: Room;
  round: Round;
  myTeam: TeamState;
  otherTeam: TeamState;
  myTeamId: TeamId;
  players: Player[];
  me: Player;
}) {
  const myEncryptorUid = round[myTeamId].encryptorUid;
  const otherEncryptorUid = round[myTeamId === "white" ? "black" : "white"].encryptorUid;
  const myEncryptor = players.find((p) => p.uid === myEncryptorUid);
  const otherEncryptor = players.find((p) => p.uid === otherEncryptorUid);
  const isMeEncryptor = myEncryptorUid === me.uid;

  // 호스트가 일정 시간 후 자동 진행
  useEffect(() => {
    if (!me.isHost) return;
    const timer = setTimeout(() => {
      advanceStage(room.id, round.roundNumber, "encrypting");
    }, 3500);
    return () => clearTimeout(timer);
  }, [me.isHost, room.id, round.roundNumber]);

  const skipToEncrypting = () => {
    advanceStage(room.id, round.roundNumber, "encrypting");
  };

  return (
    <div className="px-5 pb-5 flex-1 flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-6 mt-2">
        <div className="font-mono text-[11px] text-zinc-400 tracking-wider">ROUND</div>
        <div className="font-mono text-[18px] font-medium tracking-wide">
          {String(round.roundNumber).padStart(2, "0")} / 08
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-xs text-zinc-500 mb-1">이번 라운드의</div>
        <div className="text-[18px] font-medium">암호전달자</div>
      </div>

      <div className="flex flex-col gap-2.5 mb-6">
        <EncryptorCard
          team={myTeam}
          teamId={myTeamId}
          player={myEncryptor}
          isMine={true}
          isMe={isMeEncryptor}
        />
        <EncryptorCard
          team={otherTeam}
          teamId={myTeamId === "white" ? "black" : "white"}
          player={otherEncryptor}
          isMine={false}
          isMe={false}
        />
      </div>

      <div className="flex items-center justify-center gap-2 p-2.5 bg-zinc-50 rounded-md">
        <div className="inline-block w-2 h-2 rounded-full bg-blue-500 pulse-dot" />
        <span className="text-xs text-zinc-500">곧 시작됩니다</span>
      </div>

      {me.isHost && (
        <Button variant="ghost" className="w-full mt-3 text-xs" onClick={skipToEncrypting}>
          건너뛰기
        </Button>
      )}
    </div>
  );
}

function EncryptorCard({
  team,
  teamId,
  player,
  isMine,
  isMe,
}: {
  team: TeamState;
  teamId: TeamId;
  player: Player | undefined;
  isMine: boolean;
  isMe: boolean;
}) {
  const isWhite = teamId === "white";
  return (
    <div
      className={`bg-white rounded-xl p-4 border ${
        isMine ? "border-blue-500 border-2" : "border-zinc-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-2 h-2 rounded-full ${isWhite ? "bg-blue-500" : "bg-zinc-700"}`} />
        <span className="text-xs text-zinc-500">
          {team.name} · {isMine ? "우리 팀" : "상대 팀"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-medium ${
            isMine ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {(player?.nickname || "?")[0]}
        </div>
        <div>
          <div className="text-base font-medium">{player?.nickname || "—"}</div>
          {isMe && (
            <div className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 inline-block mt-1">
              나
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
