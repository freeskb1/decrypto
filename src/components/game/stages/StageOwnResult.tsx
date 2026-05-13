"use client";
import { Button } from "@/components/ui/button";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { Check, X, ArrowRight, AlertTriangle, Flag } from "lucide-react";

export default function StageOwnResult({
  room,
  round,
  myTeam,
  otherTeam,
  myTeamId,
  me,
  onAck,
}: {
  room: Room;
  round: Round;
  myTeam: TeamState;
  otherTeam: TeamState;
  myTeamId: TeamId;
  me: Player;
  onAck: () => void;
}) {
  const myRound = round[myTeamId];
  const success = myRound.ownCorrect === true;
  const acked = myTeam.ownResultAcked;

  return (
    <div className="px-5 pb-3 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3 mt-1">
        <div className="font-mono text-[11px] text-zinc-400 tracking-wider">
          ROUND {String(round.roundNumber).padStart(2, "0")} / 08
        </div>
        <div className="ml-auto text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
          우리팀 결과
        </div>
      </div>

      {/* 결과 헤더 */}
      <div className="text-center py-4">
        <div
          className={`w-14 h-14 rounded-full inline-flex items-center justify-center mb-3 ${
            success ? "bg-green-50" : "bg-red-50"
          }`}
        >
          {success ? (
            <Check className="w-7 h-7 text-green-600" />
          ) : (
            <X className="w-7 h-7 text-red-600" />
          )}
        </div>
        <div className="text-[20px] font-medium">
          {success ? "통신 성공" : "통신 실패"}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {success
            ? "팀원이 코드를 정확히 해석했어요"
            : "코드 해석에 실패했어요"}
        </div>
      </div>

      {/* 단서 매핑 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-2 mb-1.5 px-1.5 text-[10px] text-zinc-400">
          <span>단서</span>
          <span className="text-center w-[30px]">추측</span>
          <span className="text-center w-[30px]">정답</span>
          <span className="text-right">키워드</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {myRound.clues.map((clue, i) => {
            const ok = myRound.ownGuess && myRound.ownGuess[i] === myRound.code[i];
            return (
              <div
                key={i}
                className={`px-3 py-2.5 rounded-md grid grid-cols-[1fr_auto_auto_1fr] gap-2 items-center ${
                  ok ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <span
                  className={`text-[14px] font-medium ${
                    ok ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {clue}
                </span>
                <div className="w-[30px] h-7 rounded-md bg-white flex items-center justify-center font-mono text-[13px] font-medium">
                  <span className={ok ? "text-green-600" : "text-red-600"}>
                    {myRound.ownGuess?.[i] ?? "—"}
                  </span>
                </div>
                <div className="w-[30px] h-7 rounded-md bg-white flex items-center justify-center font-mono text-[13px] font-medium">
                  {myRound.code[i]}
                </div>
                <span
                  className={`text-[12px] text-right ${
                    ok ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {myTeam.keywords[myRound.code[i] - 1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 토큰 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="text-[11px] text-zinc-500 text-center mb-2">
          우리 팀 토큰 현황
        </div>
        <div className="flex gap-3 justify-center">
          <TokenGroup
            icon={<Flag className="w-3.5 h-3.5 text-blue-500" />}
            label="가로채기"
            count={myTeam.interceptionTokens}
            color="bg-blue-500"
          />
          <div className="w-px bg-zinc-200" />
          <TokenGroup
            icon={
              <AlertTriangle
                className={`w-3.5 h-3.5 ${
                  myTeam.miscommunicationTokens > 0
                    ? "text-red-500"
                    : "text-zinc-400"
                }`}
              />
            }
            label="통신실패"
            count={myTeam.miscommunicationTokens}
            color="bg-red-500"
          />
        </div>
        {!success && (
          <div className="text-[10px] text-red-500 text-center mt-1.5">
            +1 통신실패
          </div>
        )}
        {success && (
          <div className="text-[10px] text-zinc-400 text-center mt-1.5">
            변동 없음
          </div>
        )}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onAck}
        disabled={acked}
      >
        <ArrowRight className="w-4 h-4" />
        {acked ? "대기 중..." : "가로채기 시작"}
      </Button>
    </div>
  );
}

function TokenGroup({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] text-zinc-500">{label}</span>
      <div className="flex gap-0.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < count ? color : "border border-zinc-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
