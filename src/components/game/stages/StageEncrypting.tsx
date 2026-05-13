"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { submitClues } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { Lock, Clock, Send } from "lucide-react";
import { formatTimer } from "@/lib/utils";

export default function StageEncrypting({
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
  const otherTeamId: TeamId = myTeamId === "white" ? "black" : "white";
  const otherRound = round[otherTeamId];
  const isMeEncryptor = myRound.encryptorUid === me.uid;
  const myEncryptor = players.find((p) => p.uid === myRound.encryptorUid);
  const mySubmitted = myRound.cluesSubmittedAt !== null;

  return (
    <div className="px-5 pb-5 flex-1 flex flex-col">
      <RoundHeader round={round} badge={isMeEncryptor ? "암호전달자" : "관전 중"} />
      <TimerBar round={round} myTeamId={myTeamId} />

      {isMeEncryptor ? (
        <EncryptorView
          room={room}
          round={round}
          myTeam={myTeam}
          myTeamId={myTeamId}
          mySubmitted={mySubmitted}
        />
      ) : (
        <WaitingView
          myTeam={myTeam}
          encryptor={myEncryptor}
          mySubmitted={mySubmitted}
        />
      )}

      {/* 양 팀 상태 */}
      <div className="flex gap-1.5 mt-3">
        <StatusBadge label="우리" color="bg-blue-500" submitted={mySubmitted} />
        <StatusBadge
          label="상대"
          color="bg-zinc-700"
          submitted={otherRound.cluesSubmittedAt !== null}
        />
      </div>
    </div>
  );
}

function EncryptorView({
  room,
  round,
  myTeam,
  myTeamId,
  mySubmitted,
}: {
  room: Room;
  round: Round;
  myTeam: TeamState;
  myTeamId: TeamId;
  mySubmitted: boolean;
}) {
  const toast = useToast();
  const myRound = round[myTeamId];
  const [clues, setClues] = useState<string[]>(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (myRound.clues.length === 3) {
      setClues(myRound.clues);
    }
  }, [myRound.clues]);

  const handleSubmit = async () => {
    if (clues.some((c) => !c.trim())) {
      toast.show("단서 3개를 모두 입력해주세요", "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitClues(room.id, round.roundNumber, myTeamId, clues.map((c) => c.trim()));
      toast.show("단서 제출 완료", "success");
    } catch (e: any) {
      toast.show(e.message || "제출 실패", "error");
    }
    setSubmitting(false);
  };

  return (
    <>
      {/* 우리팀 코드 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
        <div className="text-[11px] text-zinc-500 mb-2">우리팀 코드</div>
        <div className="flex gap-2">
          {myRound.code.map((c, i) => (
            <div
              key={i}
              className="flex-1 px-2.5 py-2 bg-blue-50 rounded-md flex items-center gap-1.5"
            >
              <span className="font-mono text-[18px] font-medium text-blue-600">
                {c}
              </span>
              <span className="text-[11px] text-blue-600 opacity-70">:</span>
              <span className="text-[13px] font-medium text-blue-700 truncate">
                {myTeam.keywords[c - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 mb-2 px-1">
        단서를 순서대로 입력하세요
      </div>
      <div className="flex flex-col gap-2 mb-3.5">
        {[0, 1, 2].map((i) => (
          <Input
            key={i}
            value={clues[i]}
            onChange={(e) => {
              const next = [...clues];
              next[i] = e.target.value;
              setClues(next);
            }}
            placeholder="단서"
            disabled={mySubmitted}
            maxLength={20}
          />
        ))}
      </div>

      {/* 이전 사용 단서 */}
      <ClueHistory accumulation={myTeam.clueAccumulation} />

      <Button
        className="w-full mt-3"
        size="lg"
        onClick={handleSubmit}
        disabled={mySubmitted || submitting}
      >
        <Send className="w-4 h-4" />
        {mySubmitted ? "제출 완료" : submitting ? "제출 중..." : "단서 제출"}
      </Button>

      <div className="text-[11px] text-zinc-400 text-center mt-2">
        먼저 제출하면 상대 팀에게 90초 타이머가 시작됩니다
      </div>
    </>
  );
}

function WaitingView({
  myTeam,
  encryptor,
  mySubmitted,
}: {
  myTeam: TeamState;
  encryptor: Player | undefined;
  mySubmitted: boolean;
}) {
  return (
    <>
      {/* 코드 가림 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-3 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md text-[11px] mb-2">
          {mySubmitted ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              제출 완료
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 pulse-dot" />
              암호전달자 작성 중
            </>
          )}
        </div>
        <div className="text-sm font-medium">
          {encryptor?.nickname || "—"}가 단서를 만들고 있어요
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          키워드를 보며 미리 추측해보세요
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 mb-2 px-1">우리 팀 키워드</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {myTeam.keywords.map((kw, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl px-3 py-3">
            <div className="font-mono text-[11px] text-zinc-400 mb-1">[ {i + 1} ]</div>
            <div className="text-[16px] font-medium">{kw}</div>
          </div>
        ))}
      </div>

      <ClueHistory accumulation={myTeam.clueAccumulation} />
    </>
  );
}

function ClueHistory({
  accumulation,
}: {
  accumulation: Record<string, string[]>;
}) {
  const hasAny = Object.values(accumulation).some((arr) => arr.length > 0);
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-2.5">
      <div className="text-[11px] text-zinc-500 mb-2">우리팀이 사용한 단서</div>
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
              {(accumulation[String(n)] || []).map((c, i) => (
                <div key={i} className="text-[11px] text-zinc-500 truncate">
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!hasAny && (
        <div className="text-[10px] text-zinc-400 text-center mt-2">
          첫 라운드입니다
        </div>
      )}
    </div>
  );
}

function RoundHeader({ round, badge }: { round: Round; badge: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <div className="font-mono text-[11px] text-zinc-400 tracking-wider">
        ROUND {String(round.roundNumber).padStart(2, "0")} / 08
      </div>
      <div className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600">
        <Lock className="w-3 h-3" />
        {badge}
      </div>
    </div>
  );
}

function TimerBar({ round, myTeamId }: { round: Round; myTeamId: TeamId }) {
  const [remaining, setRemaining] = useState(90);
  const otherTeamId: TeamId = myTeamId === "white" ? "black" : "white";
  const mySubmitted = round[myTeamId].cluesSubmittedAt !== null;
  const otherSubmitted = round[otherTeamId].cluesSubmittedAt !== null;
  const otherFirst = otherSubmitted && !mySubmitted;

  useEffect(() => {
    if (!otherFirst || !round.encryptingTimerStartAt) {
      setRemaining(90);
      return;
    }
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - round.encryptingTimerStartAt!) / 1000);
      setRemaining(Math.max(0, 90 - elapsed));
    }, 500);
    return () => clearInterval(t);
  }, [otherFirst, round.encryptingTimerStartAt]);

  let statusText = "상대 팀 작성 중";
  let timerText = "--:--";

  if (mySubmitted && !otherSubmitted) {
    statusText = "상대 팀 작성 중";
    timerText = "--:--";
  } else if (otherFirst) {
    statusText = "상대팀이 먼저 제출, 빠르게 작성해주세요";
    timerText = formatTimer(remaining);
  } else if (mySubmitted && otherSubmitted) {
    statusText = "양 팀 제출 완료";
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-md mb-3">
      <Clock className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-xs text-zinc-500 flex-1 truncate">{statusText}</span>
      <span className="font-mono text-xs text-zinc-400">{timerText}</span>
    </div>
  );
}

function StatusBadge({
  label,
  color,
  submitted,
}: {
  label: string;
  color: string;
  submitted: boolean;
}) {
  return (
    <div className="flex-1 px-2.5 py-2 bg-white border border-zinc-200 rounded-md flex items-center gap-1.5 text-[11px]">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-zinc-500">{label}</span>
      <span className={`ml-auto ${submitted ? "text-green-600" : "text-zinc-400"}`}>
        {submitted ? "제출 완료" : "작성 중"}
      </span>
    </div>
  );
}
