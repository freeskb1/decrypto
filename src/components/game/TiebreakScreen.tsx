"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { subscribeTeam, submitTiebreak } from "@/lib/game";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { Screen, StatusBar, MeLine, ClueHistory, WaitLine, nameList } from "./ui";

// 동점일 때: 각 팀이 상대 키워드 4개를 팀으로 맞힌다
export default function TiebreakScreen({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const toast = useToast();
  const [white, setWhite] = useState<TeamState | null>(null);
  const [black, setBlack] = useState<TeamState | null>(null);
  const [guesses, setGuesses] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  if (!white || !black || !me?.team) {
    return (
      <Screen>
        <div className="p-6 text-sm text-muted">불러오는 중...</div>
      </Screen>
    );
  }

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const opp = myTeamId === "white" ? black : white;
  const tb = room.tiebreak;
  const mySubmitted = tb ? (myTeamId === "white" ? tb.white : tb.black) : null;
  const myBy = tb ? (myTeamId === "white" ? tb.whiteBy : tb.blackBy) : "";
  const pending = (["white", "black"] as TeamId[]).filter((t) => !(tb && tb[t]));

  const handleSubmit = async () => {
    if (guesses.every((g) => !g.trim())) {
      toast.show("하나라도 적어주세요", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await submitTiebreak(room.id, myTeamId, guesses, me.uid, me.nickname);
      if (res === "already") toast.show("이미 팀 답이 제출됐어요", "info");
    } catch (e: any) {
      toast.show(e?.message || "제출 실패", "error");
    }
    setBusy(false);
  };

  return (
    <Screen>
      <StatusBar roundLabel="동점" white={white} black={black} />
      <MeLine teamId={myTeamId} teamName={myTeam.name} role="상대 키워드 맞히기" />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <div className="relative bg-white border-2 border-ink rounded-[20px] px-4 py-4 text-center">
          <div className="text-[11px] tracking-[0.2em] font-bold text-muted">아직 승부가 안 났어요</div>
          <div className="font-serif font-black text-[18px] mt-1.5">{tb?.prefix || "동점"}</div>
          <p className="text-[13px] text-muted mt-2">
            팀끼리 의논해서 {opp.name} 키워드 4개를 번호대로 적어요. 더 많이 맞힌 팀이 이겨요 (띄어쓰기·대소문자
            무시).
          </p>
        </div>

        <ClueHistory title={`${opp.name} 번호별 단서`} accumulation={opp.clueAccumulation} />

        {mySubmitted ? (
          <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 text-[13px]">
            <b className="font-black">우리 팀 답 제출 완료</b>
            <span className="text-muted"> · {myBy}</span>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {mySubmitted.map((g, i) => (
                <div key={i} className="bg-paper rounded-lg p-1.5 text-center font-bold break-all">
                  <small className="block font-mono text-muted">{i + 1}</small>
                  {g}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <label key={i} className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted">
                    {opp.name} {i + 1}번
                  </span>
                  <Input
                    value={guesses[i]}
                    onChange={(e) => {
                      const next = [...guesses];
                      next[i] = e.target.value;
                      setGuesses(next);
                    }}
                    maxLength={20}
                    placeholder="키워드"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted text-center">팀에서 한 사람만 적어서 제출해요. 제출하면 바꿀 수 없어요.</p>
            <Button size="lg" variant="red" className="w-full" onClick={handleSubmit} disabled={busy}>
              {busy ? "제출하는 중..." : "우리 팀 답 제출"}
            </Button>
          </>
        )}

        <div className="mt-auto">
          <WaitLine>
            기다리는 중:{" "}
            <b className="font-black">
              {nameList(pending.map((t) => (t === "white" ? white : black).name))}
            </b>
            {" "}답 ({nameList(players.filter((p) => p.team && pending.includes(p.team)).map((p) => p.nickname))})
          </WaitLine>
        </div>
      </div>
    </Screen>
  );
}

