"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitInterceptGuess } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { Radar, ArrowRight, Flag, AlertTriangle, Info, WifiOff } from "lucide-react";

export default function StageIntercept({
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
  const toast = useToast();
  const otherTeamId: TeamId = myTeamId === "white" ? "black" : "white";
  const otherRound = round[otherTeamId];

  const [guess, setGuess] = useState<(number | null)[]>([null, null, null]);
  const [submitting, setSubmitting] = useState(false);

  const myInterceptOnOther = otherRound.interceptGuess; // 우리가 상대 코드에 대해 한 가로채기
  const submitted = otherRound.interceptGuessAt !== null;
  const intercepted = otherRound.intercepted;

  // 1라운드는 가로채기 없음 → 자동 ack
  const isFirstRound = round.roundNumber === 1;
  useEffect(() => {
    if (isFirstRound && !myTeam.interceptAcked) {
      onAck();
    }
  }, [isFirstRound, myTeam.interceptAcked, onAck]);

  useEffect(() => {
    if (myInterceptOnOther) {
      setGuess(myInterceptOnOther);
    }
  }, [myInterceptOnOther]);

  if (isFirstRound) {
    return (
      <div className="px-5 pb-5 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-zinc-100 inline-flex items-center justify-center mb-3">
          <Info className="w-7 h-7 text-zinc-400" />
        </div>
        <div className="text-base font-medium mb-1">1라운드는 가로채기 없음</div>
        <div className="text-xs text-zinc-500 mb-4">
          정보가 부족하므로 1라운드는 가로채기를 건너뜁니다
        </div>
        <Button className="w-full" size="lg" onClick={onAck}>
          <ArrowRight className="w-4 h-4" />다음 라운드로
        </Button>
      </div>
    );
  }

  const isCompleted = guess.every((g) => g !== null);

  const handleSelect = (clueIdx: number, num: number) => {
    if (submitted) return;
    const next = [...guess];
    for (let i = 0; i < 3; i++) {
      if (i !== clueIdx && next[i] === num) next[i] = null;
    }
    next[clueIdx] = num;
    setGuess(next);
  };

  const handleSubmit = async () => {
    if (!isCompleted) return;
    setSubmitting(true);
    try {
      await submitInterceptGuess(
        room.id,
        round.roundNumber,
        myTeamId,
        guess as number[]
      );
      toast.show("가로채기 제출 완료", "success");
    } catch (e: any) {
      toast.show(e.message || "제출 실패", "error");
    }
    setSubmitting(false);
  };

  // 제출 후 결과 화면
  if (submitted) {
    return (
      <ResultView
        round={round}
        otherRound={otherRound}
        myTeam={myTeam}
        intercepted={intercepted === true}
        myInterceptGuess={myInterceptOnOther || []}
        onAck={onAck}
        acked={myTeam.interceptAcked}
      />
    );
  }

  // 제출 전 - 가로채기 입력
  return (
    <div className="px-5 pb-3 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3 mt-1">
        <div className="font-mono text-[11px] text-zinc-400 tracking-wider">
          ROUND {String(round.roundNumber).padStart(2, "0")} / 08
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700">
          <Radar className="w-3 h-3" />상대팀 가로채기
        </div>
      </div>

      {/* 상대팀 단서 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-[11px] text-zinc-500">
            상대팀이 전송한 단서
          </span>
          <span className="ml-auto text-[10px] text-zinc-400">{otherTeam.name}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {otherRound.clues.map((clue, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-50 rounded-md"
            >
              {guess[i] !== null ? (
                <div className="w-6 h-6 rounded-md border-2 border-amber-500 flex items-center justify-center font-mono text-xs font-medium text-amber-600">
                  {guess[i]}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-md border border-dashed border-zinc-300 flex items-center justify-center font-mono text-xs text-zinc-400">
                  ?
                </div>
              )}
              <span className="text-[16px] font-medium">{clue}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 상대팀 누적 단서 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 mb-3">
        <div className="text-[11px] text-zinc-500 mb-2">상대팀이 사용한 단서</div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-zinc-50 rounded-md p-1.5 text-center min-h-[56px]"
            >
              <div className="font-mono text-[10px] text-zinc-400 pb-1 mb-1 border-b border-zinc-200">
                {n}번
              </div>
              <div className="flex flex-col gap-0.5">
                {(otherTeam.clueAccumulation[String(n)] || []).map((c, i) => (
                  <div key={i} className="text-[11px] text-zinc-500 truncate">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 가로채기 입력 */}
      <div className="text-[11px] text-zinc-500 mb-1.5 px-1">
        상대팀 코드를 추측하세요
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="flex flex-col gap-2.5">
          {otherRound.clues.map((clue, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 text-[13px] text-zinc-600 truncate">{clue}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => {
                  const isThis = guess[i] === n;
                  const usedInOther = guess.some(
                    (g, idx) => idx !== i && g === n
                  );
                  return (
                    <button
                      key={n}
                      disabled={usedInOther}
                      onClick={() => handleSelect(i, n)}
                      className={`w-7 h-7 font-mono text-[13px] rounded-md border transition-colors ${
                        isThis
                          ? "bg-amber-50 text-amber-600 border-amber-500"
                          : usedInOther
                          ? "opacity-30 border-zinc-200"
                          : "border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={!isCompleted || submitting}
      >
        <Radar className="w-4 h-4" />
        {submitting
          ? "제출 중..."
          : isCompleted
          ? `가로채기 제출 (${guess.join(" · ")})`
          : "각 단서 번호 선택"}
      </Button>
    </div>
  );
}

function ResultView({
  round,
  otherRound,
  myTeam,
  intercepted,
  myInterceptGuess,
  onAck,
  acked,
}: {
  round: Round;
  otherRound: any;
  myTeam: TeamState;
  intercepted: boolean;
  myInterceptGuess: number[];
  onAck: () => void;
  acked: boolean;
}) {
  return (
    <div className="px-5 pb-3 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3 mt-1">
        <div className="font-mono text-[11px] text-zinc-400 tracking-wider">
          ROUND {String(round.roundNumber).padStart(2, "0")} / 08
        </div>
        <div className="ml-auto text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
          가로채기 결과
        </div>
      </div>

      <div className="text-center py-3">
        <div
          className={`w-14 h-14 rounded-full inline-flex items-center justify-center mb-3 ${
            intercepted ? "bg-blue-50" : "bg-zinc-100 border border-zinc-200"
          }`}
        >
          {intercepted ? (
            <Flag className="w-7 h-7 text-blue-500" />
          ) : (
            <WifiOff className="w-7 h-7 text-zinc-400" />
          )}
        </div>
        <div className="text-[20px] font-medium">
          {intercepted ? "가로채기 성공" : "가로채기 실패"}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {intercepted
            ? "상대 코드를 정확히 해독했어요"
            : "아쉬워요. 다음 라운드에 다시 도전하세요"}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Radar className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] text-zinc-500">상대팀 코드 해독 결과</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-1.5 px-1.5 text-[10px] text-zinc-400">
          <span>단서</span>
          <span className="text-center w-[36px]">우리 추측</span>
          <span className="text-center w-[36px]">정답</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {otherRound.clues.map((clue: string, i: number) => {
            const ok = myInterceptGuess[i] === otherRound.code[i];
            return (
              <div
                key={i}
                className={`px-3 py-2.5 rounded-md grid grid-cols-[1fr_auto_auto] gap-3 items-center ${
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
                <div className="w-[36px] h-7 rounded-md bg-white flex items-center justify-center font-mono text-[13px] font-medium">
                  <span className={ok ? "text-green-600" : "text-red-600"}>
                    {myInterceptGuess[i]}
                  </span>
                </div>
                <div className="w-[36px] h-7 rounded-md bg-white flex items-center justify-center font-mono text-[13px] font-medium">
                  {otherRound.code[i]}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 p-2 bg-zinc-50 rounded-md flex gap-1.5 items-start">
          <Info className="w-3 h-3 text-zinc-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-zinc-400 leading-relaxed">
            상대팀 키워드는 게임 종료 시 공개됩니다
          </span>
        </div>
      </div>

      {/* 토큰 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="text-[11px] text-zinc-500 text-center mb-2">
          우리 팀 토큰 현황
        </div>
        <div className="flex gap-3 justify-center">
          <div className="flex items-center gap-1.5">
            <Flag
              className={`w-3.5 h-3.5 ${
                myTeam.interceptionTokens > 0 ? "text-blue-500" : "text-zinc-400"
              }`}
            />
            <span className="text-[11px] text-zinc-500">가로채기</span>
            <div className="flex gap-0.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < myTeam.interceptionTokens
                      ? "bg-blue-500"
                      : "border border-zinc-300"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="w-px bg-zinc-200" />
          <div className="flex items-center gap-1.5">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                myTeam.miscommunicationTokens > 0
                  ? "text-red-500"
                  : "text-zinc-400"
              }`}
            />
            <span className="text-[11px] text-zinc-500">통신실패</span>
            <div className="flex gap-0.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < myTeam.miscommunicationTokens
                      ? "bg-red-500"
                      : "border border-zinc-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <div
          className={`text-[10px] text-center mt-1.5 ${
            intercepted ? "text-blue-600" : "text-zinc-400"
          }`}
        >
          {intercepted ? "+1 가로채기" : "변동 없음"}
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={onAck} disabled={acked}>
        <ArrowRight className="w-4 h-4" />
        {acked ? "대기 중..." : "다음 라운드"}
      </Button>
    </div>
  );
}
