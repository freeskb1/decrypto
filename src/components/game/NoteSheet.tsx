"use client";
import { useEffect, useState } from "react";
import { subscribeAllRounds } from "@/lib/game";
import type { Room, TeamState, TeamId, Round } from "@/types/game";
import { cluesPublic, codeRevealed, otherTeamOf, MAX_ROUNDS } from "@/types/game";
import { cn } from "@/lib/utils";
import { ClueHistory, KeywordGrid } from "./ui";

// 기록지: 공개된 것만 보여 준다 (이번 라운드 암호는 공개 전까지 숨김)
export default function NoteSheet({
  room,
  white,
  black,
  myTeamId,
  onClose,
  reveal = false,
}: {
  room: Room;
  white: TeamState;
  black: TeamState;
  myTeamId: TeamId;
  onClose: () => void;
  reveal?: boolean;
}) {
  const [tab, setTab] = useState<TeamId>(myTeamId);
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    const unsub = subscribeAllRounds(room.id, setRounds);
    return () => unsub();
  }, [room.id]);

  const team = tab === "white" ? white : black;
  const isMine = tab === myTeamId;
  const showKeywords = isMine || reveal;

  return (
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="paper-lines w-full max-w-md rounded-t-[24px] sm:rounded-[24px] px-4 pt-4 pb-6 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="font-serif font-black text-[20px]">기록지</div>
          <span className="font-mono text-xs text-muted">
            R{room.roundNumber} / {MAX_ROUNDS}
          </span>
          <button
            className="ml-auto rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-xs font-black"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="flex gap-1.5 mb-3">
          {(["white", "black"] as TeamId[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-black border-[1.5px]",
                tab === t
                  ? t === "white"
                    ? "bg-wt text-wt-ink border-wt-ink"
                    : "bg-bt text-bt-ink border-bt"
                  : "bg-white text-muted border-line"
              )}
            >
              {(t === "white" ? white : black).name}
              {t === myTeamId ? " (우리)" : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs font-bold text-muted mb-1.5 px-1">
              {team.name} 키워드 {showKeywords ? "" : "· 게임이 끝나면 공개"}
            </div>
            <KeywordGrid keywords={showKeywords ? team.keywords : ["???", "???", "???", "???"]} teamId={tab} />
          </div>

          <ClueHistory title="번호별 단서 (공개된 것만)" accumulation={team.clueAccumulation} />

          <div className="bg-white border-[1.5px] border-line rounded-2xl py-1">
            <div className="grid grid-cols-[28px_1fr_44px_44px_36px] gap-1.5 px-3 py-1.5 border-b border-line text-[10px] font-bold text-muted">
              <span>#</span>
              <span>단서</span>
              <span className="text-center">{otherTeamOf(tab) === myTeamId ? "우리 가로" : "가로채기"}</span>
              <span className="text-center">해독</span>
              <span className="text-center">정답</span>
            </div>
            {rounds.length === 0 && (
              <div className="text-xs text-muted text-center py-3">아직 기록이 없어요</div>
            )}
            {rounds.map((r) => {
              const d = r[tab];
              const showClues = cluesPublic(r, tab) && d.clues.length > 0;
              const showCode = codeRevealed(r, tab);
              return (
                <div key={r.roundNumber} className="px-3 py-1.5 border-b border-line last:border-b-0">
                  {!showClues ? (
                    <div className="grid grid-cols-[28px_1fr] gap-1.5 text-xs text-muted py-0.5">
                      <span className="font-mono">{String(r.roundNumber).padStart(2, "0")}</span>
                      <span>공개 전</span>
                    </div>
                  ) : (
                    d.clues.map((clue, i) => {
                      const ig = showCode ? d.interceptGuess?.[i] : undefined;
                      const og = showCode ? d.ownGuess?.[i] : undefined;
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[28px_1fr_44px_44px_36px] gap-1.5 items-center py-0.5 text-[13px]"
                        >
                          <span className="font-mono text-[11px] text-muted">
                            {i === 0 ? String(r.roundNumber).padStart(2, "0") : ""}
                          </span>
                          <span className="font-bold truncate">{clue}</span>
                          <Cell value={r.roundNumber === 1 ? undefined : ig} ok={ig === d.code[i]} />
                          <Cell value={og} ok={og === d.code[i]} />
                          <span className="font-mono font-bold text-center">
                            {showCode ? d.code[i] : "?"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ value, ok }: { value: number | undefined; ok: boolean }) {
  if (value === undefined) {
    return <span className="font-mono text-center text-hint">—</span>;
  }
  return (
    <span className={cn("font-mono font-bold text-center", ok ? "text-ok" : "text-stamp")}>{value}</span>
  );
}
