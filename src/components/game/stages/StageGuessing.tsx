"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitOwnGuess } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { Target, Check, Eye } from "lucide-react";

export default function StageGuessing({
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
  const toast = useToast();
  const myRound = round[myTeamId];
  const isMeEncryptor = myRound.encryptorUid === me.uid;
  const [guess, setGuess] = useState<(number | null)[]>([null, null, null]);
  const [submitting, setSubmitting] = useState(false);

  const myEncryptor = players.find((p) => p.uid === myRound.encryptorUid);
  const submitted = myRound.ownGuessAt !== null;

  // 이미 제출된 추측 반영
  useEffect(() => {
    if (myRound.ownGuess) {
      setGuess(myRound.ownGuess);
    }
  }, [myRound.ownGuess]);

  const isCompleted = guess.every((g) => g !== null);

  const handleSelect = (clueIdx: number, num: number) => {
    if (isMeEncryptor || submitted) return;
    const next = [...guess];
    // 다른 칸에서 같은 번호 쓰고 있었으면 빼기
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
      await submitOwnGuess(
        room.id,
        round.roundNumber,
        myTeamId,
        guess as number[]
      );
      toast.show("추측 제출 완료", "success");
    } catch (e: any) {
      toast.show(e.message || "제출 실패", "error");
    }
    setSubmitting(false);
  };

  return (
    <div className="px-5 pb-3 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3 mt-1">
        <div className="font-mono text-[11px] text-zinc-400 tracking-wider">
          ROUND {String(round.roundNumber).padStart(2, "0")} / 08
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600">
          {isMeEncryptor ? (
            <>
              <Eye className="w-3 h-3" />지켜보기만
            </>
          ) : (
            <>
              <Target className="w-3 h-3" />우리 팀 추측
            </>
          )}
        </div>
      </div>

      {/* 단서 3개 공개 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-[11px] text-zinc-500">
            {isMeEncryptor ? "내가 보낸 단서" : "암호전달자가 전송한 단서"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {myRound.clues.map((clue, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-50 rounded-md"
            >
              {isMeEncryptor ? (
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-mono text-xs font-medium">
                  {myRound.code[i]}
                </div>
              ) : guess[i] !== null ? (
                <div className="w-6 h-6 rounded-md border-2 border-blue-500 flex items-center justify-center font-mono text-xs font-medium text-blue-600">
                  {guess[i]}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-md border border-dashed border-zinc-300 flex items-center justify-center font-mono text-xs text-zinc-400">
                  ?
                </div>
              )}
              <span className="text-[16px] font-medium">{clue}</span>
              {isMeEncryptor && (
                <span className="ml-auto text-[11px] text-zinc-400">
                  {myTeam.keywords[myRound.code[i] - 1]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 키워드 참고 (암호전달자 아닐 때) */}
      {!isMeEncryptor && (
        <>
          <div className="text-[11px] text-zinc-500 mb-1.5 px-1">우리 팀 키워드</div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {myTeam.keywords.map((kw, i) => (
              <div
                key={i}
                className="bg-white border border-zinc-200 rounded-md py-1.5 px-1 text-center"
              >
                <div className="font-mono text-[10px] text-zinc-400">{i + 1}</div>
                <div className="text-[12px] font-medium truncate">{kw}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 추측 입력 (암호전달자 아닐 때) */}
      {!isMeEncryptor && (
        <>
          <div className="text-[11px] text-zinc-500 mb-1.5 px-1">
            각 단서에 해당하는 키워드 번호를 선택하세요
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
            <div className="flex flex-col gap-2.5">
              {myRound.clues.map((clue, i) => (
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
                          disabled={submitted || usedInOther}
                          onClick={() => handleSelect(i, n)}
                          className={`w-7 h-7 font-mono text-[13px] rounded-md border transition-colors ${
                            isThis
                              ? "bg-blue-50 text-blue-600 border-blue-500"
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
        </>
      )}

      {/* 암호전달자 시점: 팀원 추측 실시간 */}
      {isMeEncryptor && (
        <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] text-zinc-500">팀원의 현재 추측</span>
          </div>
          <div className="text-xs text-zinc-400 text-center py-2">
            팀원이 추측 중...
          </div>
        </div>
      )}

      {!isMeEncryptor && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={!isCompleted || submitted || submitting}
        >
          <Check className="w-4 h-4" />
          {submitted
            ? "제출 완료"
            : isCompleted
            ? `추측 제출 (${guess.join(" · ")})`
            : "각 단서 번호 선택"}
        </Button>
      )}

      {isMeEncryptor && (
        <div className="text-center text-xs text-zinc-400 py-2">
          팀원이 코드를 추측하고 있어요. 의논에 참여할 수 없습니다.
        </div>
      )}
    </div>
  );
}
