"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { draftKey, setDraft, submitTeamGuess } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { ClueCards, ClueHistory, DigitPicker, HoldCode, KeywordGrid } from "../ui";

// 한 팀 단서에 대해: 상대 팀 가로채기(intercept) 또는 그 팀 해독(decode)
export default function StageGuess({
  room,
  round,
  target,
  kind,
  myTeamId,
  me,
  myTeam,
  targetTeam,
  actingTeam,
}: {
  room: Room;
  round: Round;
  target: TeamId;
  kind: "intercept" | "decode";
  myTeamId: TeamId;
  me: Player;
  myTeam: TeamState;
  targetTeam: TeamState;
  actingTeam: TeamState;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const data = round[target];
  const actingTeamId: TeamId = kind === "intercept" ? (target === "white" ? "black" : "white") : target;
  const isTargetEncryptor = data.encryptorUid === me.uid;
  const canAct = myTeamId === actingTeamId && !(kind === "decode" && isTargetEncryptor);

  const key = draftKey(target, kind);
  const draft = round.drafts[key];
  const picks = draft ? draft.picks : [0, 0, 0];
  const complete = picks.every((p) => p >= 1 && p <= 4);

  const handlePick = (i: number, n: number) => {
    const next = [...picks];
    if (next[i] === n) {
      next[i] = 0; // 같은 숫자 다시 누르면 비우기
    } else {
      for (let j = 0; j < 3; j++) if (j !== i && next[j] === n) next[j] = 0;
      next[i] = n;
    }
    setDraft(room.id, round.roundNumber, key, next, me.uid, me.nickname).catch(() => {
      toast.show("저장 실패. 다시 눌러주세요", "error");
    });
  };

  const handleSubmit = async () => {
    if (!complete) return;
    setSubmitting(true);
    try {
      const res = await submitTeamGuess(room.id, round.roundNumber, target, kind, picks, me.uid);
      if (res === "already") toast.show("이미 팀 답이 제출됐어요", "info");
    } catch (e: any) {
      toast.show(e?.message || "제출 실패", "error");
    }
    setSubmitting(false);
  };

  const draftText = !draft
    ? "아직 아무도 안 골랐어요 · 팀이 같이 보는 답안이에요"
    : draft.editorUid === me.uid
    ? "팀이 같이 보는 답안 · 내가 고치는 중"
    : null;

  return (
    <>
      <div>
        <h2 className="font-serif font-black text-[22px] leading-snug">{targetTeam.name} 단서</h2>
        <p className="text-[13px] text-muted mt-0.5">
          {kind === "intercept"
            ? `${actingTeam.name}이 먼저 가로채요. 그다음 ${targetTeam.name}이 해독해요.`
            : `${targetTeam.name}이 해독해요. 암호전달자는 말하지 않아요.`}
        </p>
      </div>
      <ClueCards clues={data.clues} teamId={target} />

      {canAct && (
        <>
          {kind === "decode" && <KeywordGrid keywords={myTeam.keywords} teamId={myTeamId} />}
          <DigitPicker clues={data.clues} picks={picks} onPick={handlePick} disabled={submitting} />
          <p className="text-xs text-muted text-center">
            {draftText ?? (
              <>
                팀이 같이 보는 답안 · <b className="text-ink">{draft?.editorName}</b>이(가) 고치는 중
              </>
            )}
          </p>
          <Button
            size="lg"
            variant={kind === "intercept" ? "red" : "default"}
            className="w-full"
            onClick={handleSubmit}
            disabled={!complete || submitting}
          >
            {submitting
              ? "제출하는 중..."
              : complete
              ? `${kind === "intercept" ? "가로채기" : "해독"} 제출 · ${picks.join("-")}`
              : "단서마다 숫자를 골라요"}
          </Button>
        </>
      )}

      {!canAct && kind === "decode" && isTargetEncryptor && (
        <>
          <HoldCode code={data.code} />
          <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 text-[13px]">
            <b className="font-black">말하지 말고 지켜봐요.</b>
            <span className="text-muted"> 팀원들이 해독하는 동안 표정도 조심!</span>
          </div>
        </>
      )}

      {!canAct && !(kind === "decode" && isTargetEncryptor) && (
        <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 text-[13px]">
          {kind === "intercept" ? (
            myTeamId === target ? (
              <>
                <b className="font-black">{actingTeam.name}이 우리 단서를 가로채려고 의논 중</b>
                <span className="text-muted"> · 조용히 들어요. 끝나면 우리 팀이 해독해요.</span>
                {isTargetEncryptor && (
                  <div className="mt-2">
                    <HoldCode code={data.code} />
                  </div>
                )}
              </>
            ) : null
          ) : (
            <>
              <b className="font-black">{targetTeam.name}이 해독하는 중</b>
              <span className="text-muted">
                {round.roundNumber >= 2
                  ? " · 우리 가로채기 답은 이미 냈어요."
                  : " · 1라운드는 가로채기 없이 지켜봐요."}
              </span>
            </>
          )}
        </div>
      )}

      <ClueHistory title={`${targetTeam.name} 지난 단서`} accumulation={targetTeam.clueAccumulation} />
    </>
  );
}
