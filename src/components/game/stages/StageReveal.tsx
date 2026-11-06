"use client";
import { Button } from "@/components/ui/button";
import type { Round, TeamState, TeamId } from "@/types/game";
import { cn } from "@/lib/utils";

// 다 같이 공개: 두 팀 결과를 한 번에 (우리 팀 먼저), 모든 폰이 같은 결과를 본다
export default function StageReveal({
  round,
  myTeamId,
  myTeam,
  otherTeam,
  acked,
  allAcked,
  onAck,
  onSkip,
}: {
  round: Round;
  myTeamId: TeamId;
  myTeam: TeamState;
  otherTeam: TeamState;
  acked: boolean;
  allAcked: boolean;
  onAck: () => void;
  onSkip: () => void;
}) {
  const otherId: TeamId = myTeamId === "white" ? "black" : "white";
  return (
    <>
      <TeamResult round={round} target={myTeamId} mine targetTeam={myTeam} otherTeam={otherTeam} />
      <TeamResult round={round} target={otherId} mine={false} targetTeam={otherTeam} otherTeam={myTeam} />

      <p className="text-[13px] text-muted text-center">단서는 기록지의 번호 칸에 자동으로 정리돼요</p>

      <Button size="lg" className="w-full" onClick={onAck} disabled={acked}>
        {acked ? "확인함 · 다른 사람 기다리는 중" : "확인"}
      </Button>
      {acked && !allAcked && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onSkip}>
          기다리지 않고 넘어가기
        </Button>
      )}
    </>
  );
}

function TeamResult({
  round,
  target,
  mine,
  targetTeam,
  otherTeam,
}: {
  round: Round;
  target: TeamId;
  mine: boolean;
  targetTeam: TeamState;
  otherTeam: TeamState;
}) {
  const data = round[target];
  const hasIntercept = round.roundNumber >= 2;
  const intercepted = data.intercepted === true;
  const decoded = data.ownCorrect === true;
  const stamp = intercepted ? "가로채기!" : decoded ? "해독 성공" : "해독 실패";
  const dark = target === "black";
  return (
    <div
      className={cn(
        "relative rounded-[20px] px-4 pt-[18px] pb-3 text-center mt-2",
        dark ? "bg-bt text-bt-ink" : "bg-wt text-wt-ink border-2 border-wt-ink"
      )}
    >
      <span
        className={cn(
          "stamp-mark absolute -right-1.5 -top-3.5 border-[3px] rounded-lg px-2.5 py-1 font-serif font-black text-[15px] bg-white/85",
          intercepted || !decoded ? "border-stamp text-stamp" : "border-ok text-ok"
        )}
      >
        {stamp}
      </span>
      <div className="flex justify-center items-center gap-1.5">
        <span
          className={cn(
            "text-[13px] font-black rounded-full px-2.5 py-0.5",
            dark ? "bg-bt-ink text-bt" : "bg-wt-ink text-wt"
          )}
        >
          {targetTeam.name}
        </span>
        <span className="text-[11px] tracking-[0.2em] font-bold opacity-70">암호{mine ? " · 우리 팀" : ""}</span>
      </div>
      <div className="font-mono font-bold text-[40px] tracking-[0.2em] mt-1 mb-2">{data.code.join("·")}</div>
      <div className="flex flex-col gap-1.5 text-left">
        <ResultRow
          bad={!decoded}
          text={`${targetTeam.name} 해독 · ${(data.ownGuess || []).join("-") || "—"} · ${decoded ? "성공" : "실패"}`}
          right={decoded ? "—" : "실패 +1"}
        />
        {hasIntercept && (
          <ResultRow
            bad={intercepted}
            text={`${otherTeam.name} 가로채기 · ${(data.interceptGuess || []).join("-") || "—"} · ${
              intercepted ? "성공" : "실패"
            }`}
            right={intercepted ? `${otherTeam.name} +1` : "—"}
          />
        )}
      </div>
      <div className={cn("flex flex-col gap-1 mt-2.5 pt-2 border-t text-left", dark ? "border-white/20" : "border-wt-ink/20")}>
        {data.clues.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-[15px]">
            <span className="font-black flex-1 min-w-0 break-all">{c}</span>
            <span className="font-mono font-bold">→ {data.code[i]}</span>
            {mine && (
              <span className="text-xs opacity-60 w-16 text-right truncate">
                {targetTeam.keywords[data.code[i] - 1] || ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultRow({ bad, text, right }: { bad: boolean; text: string; right: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold",
        bad ? "bg-got text-stamp" : "bg-paper text-ok"
      )}
    >
      <span className="min-w-0">{text}</span>
      <span className="ml-auto font-mono whitespace-nowrap">{right}</span>
    </div>
  );
}
