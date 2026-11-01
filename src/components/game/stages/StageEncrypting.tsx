"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { submitClues } from "@/lib/game";
import type { Room, Round, TeamState, TeamId, Player } from "@/types/game";
import { validateClues } from "@/types/game";
import { ClueHistory, HoldCode, KeywordGrid } from "../ui";

export default function StageEncrypting({
  room,
  round,
  myTeam,
  myTeamId,
  me,
  encryptorName,
}: {
  room: Room;
  round: Round;
  myTeam: TeamState;
  myTeamId: TeamId;
  me: Player;
  encryptorName: string;
}) {
  const myRound = round[myTeamId];
  const isMeEncryptor = myRound.encryptorUid === me.uid;
  const mySubmitted = myRound.cluesSubmittedAt !== null;

  if (isMeEncryptor) {
    return (
      <EncryptorView
        room={room}
        round={round}
        myTeam={myTeam}
        myTeamId={myTeamId}
        me={me}
        submitted={mySubmitted}
      />
    );
  }

  return (
    <>
      <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3.5">
        <h2 className="font-serif font-black text-[20px] leading-snug">
          {mySubmitted ? "우리 단서 준비 완료" : `${encryptorName}님이 단서를 쓰는 중`}
        </h2>
        <p className="text-[13px] text-muted mt-1">
          {mySubmitted
            ? "상대 팀 암호전달자를 기다려요. 단서는 차례가 오면 모두에게 공개돼요."
            : "암호전달자에게 말 걸지 말고, 키워드를 보며 기다려요."}
        </p>
      </div>
      <div className="text-xs font-bold text-muted px-1">우리 팀 키워드</div>
      <KeywordGrid keywords={myTeam.keywords} teamId={myTeamId} big />
      <ClueHistory title="우리 팀 지난 단서" accumulation={myTeam.clueAccumulation} />
    </>
  );
}

function EncryptorView({
  room,
  round,
  myTeam,
  myTeamId,
  me,
  submitted,
}: {
  room: Room;
  round: Round;
  myTeam: TeamState;
  myTeamId: TeamId;
  me: Player;
  submitted: boolean;
}) {
  const toast = useToast();
  const myRound = round[myTeamId];
  const [clues, setClues] = useState<string[]>(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [holding, setHolding] = useState(false);

  // 지난 라운드 단서는 모두 공개돼 기록지에 쌓여 있음
  const previous = Object.values(myTeam.clueAccumulation).reduce<string[]>(
    (acc, arr) => acc.concat(arr),
    []
  );

  const handleSubmit = async () => {
    const bad = validateClues(clues, myTeam.keywords, previous);
    if (bad) {
      toast.show(bad, "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitClues(room.id, round.roundNumber, myTeamId, me.uid, clues);
      toast.show("단서 확정!", "success");
    } catch (e: any) {
      toast.show(e?.message || "제출 실패", "error");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <>
        <HoldCode code={myRound.code} />
        <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3.5">
          <h2 className="font-serif font-black text-[20px]">단서 확정 완료</h2>
          <p className="text-[13px] text-muted mt-1">
            이제 말하지 말고 기다려요. 차례가 오면 단서가 모두의 화면에 떠요.
          </p>
          <div className="flex flex-col gap-1.5 mt-3">
            {myRound.clues.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-paper rounded-xl px-3 py-2">
                <span className="font-mono text-xs text-muted w-4">{["①", "②", "③"][i]}</span>
                <span className="text-[18px] font-black break-all">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <ClueHistory title="우리 팀 지난 단서" accumulation={myTeam.clueAccumulation} />
      </>
    );
  }

  return (
    <>
      <KeywordGrid keywords={myTeam.keywords} teamId={myTeamId} />
      <HoldCode code={myRound.code} onHoldChange={setHolding} />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <label
            key={i}
            className="flex items-center gap-2.5 bg-white border-[1.5px] border-line rounded-2xl pl-3 pr-1.5 py-1.5"
          >
            <b className="font-mono text-[18px] w-[26px] h-[26px] rounded-lg bg-ink text-paper grid place-items-center flex-[0_0_26px]">
              {holding ? myRound.code[i] : "?"}
            </b>
            <Input
              value={clues[i]}
              onChange={(e) => {
                const next = [...clues];
                next[i] = e.target.value;
                setClues(next);
              }}
              placeholder={
                holding
                  ? `${myRound.code[i]}번 「${myTeam.keywords[myRound.code[i] - 1] || ""}」 단서`
                  : `${i + 1}번째 단서`
              }
              maxLength={20}
              className="border-0 px-1 text-[17px] font-bold focus:border-0"
            />
          </label>
        ))}
      </div>
      <p className="text-[13px] text-muted">
        암호 카드를 누르고 있으면 순서가 보여요. 키워드 자체·글자 수·발음·이미 쓴 단서는 못 써요.
      </p>
      <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "확정하는 중..." : "단서 확정"}
      </Button>
      <ClueHistory title="우리 팀 지난 단서" accumulation={myTeam.clueAccumulation} />
    </>
  );
}
