"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { draftKey, setDraft, submitTeamGuess } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { ClueCards, ClueHistory, DigitPicker, HoldCode, KeywordGrid } from "../ui";

// 해독(decode): 우리 팀 단서로 우리 암호 맞히기 / 가로채기(intercept): 상대 팀 단서로 상대 암호 맞히기
// 두 팀이 동시에 하고, 제출한 답의 결과는 두 팀 다 끝난 뒤 다 같이 공개 때 나온다
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

  const submitted = kind === "decode" ? data.ownGuess : data.interceptGuess;

  const draftText = !draft
    ? "아직 아무도 안 골랐어요 · 팀이 같이 보는 답안이에요"
    : draft.editorUid === me.uid
    ? "팀이 같이 보는 답안 · 내가 고치는 중"
    : null;

  return (
    <>
      <div>
        <h2 className="font-serif font-black text-[22px] leading-snug">
          {kind === "intercept" ? `가로채기 · ${targetTeam.name} 단서` : `해독 · 우리 팀 단서`}
        </h2>
        <p className="text-[13px] text-muted mt-0.5">
          {kind === "intercept" ? (
            <>
              상대 팀 단서로 상대 암호를 맞혀요.
              <br />
              상대 팀도 지금 우리 단서를 가로채는 중이에요.
            </>
          ) : (
            <>
              상대 팀도 지금 자기 단서를 해독하는 중이에요.
              <br />
              결과는 두 팀 다 끝난 뒤에 같이 공개돼요.
            </>
          )}
        </p>
      </div>
      <ClueCards clues={data.clues} teamId={target} />

      {canAct && submitted && (
        <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 text-center">
          <div className="text-xs font-bold text-muted">우리 팀 {kind === "intercept" ? "가로채기" : "해독"} 답 제출함</div>
          <div className="font-mono font-bold text-[30px] tracking-[0.2em] mt-1">{submitted.join("-")}</div>
          <div className="text-[13px] text-muted mt-1">상대 팀이 끝나면 다음으로 넘어가요</div>
        </div>
      )}

      {canAct && !submitted && (
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
            {submitted ? (
              <>
                <b className="font-black">우리 팀 답 제출함 · {submitted.join("-")}</b>
                <span className="text-muted"> 상대 팀이 끝나면 다음으로 넘어가요</span>
              </>
            ) : (
              <>
                <b className="font-black">말하지 말고 지켜봐요.</b>
                <span className="text-muted"> 팀원들이 해독하는 동안 표정도 조심!</span>
              </>
            )}
          </div>
        </>
      )}

      <ClueHistory title={`${targetTeam.name} 지난 단서`} accumulation={targetTeam.clueAccumulation} />
    </>
  );
}
