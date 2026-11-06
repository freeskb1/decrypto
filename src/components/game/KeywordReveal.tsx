"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  subscribeTeam,
  shuffleTeamKeywords,
  markTeamReady,
  startFirstRoundIfReady,
} from "@/lib/game";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { Check, Shuffle } from "lucide-react";
import { Screen, StatusBar, MeLine, KeywordGrid, WaitLine, nameList } from "./ui";

export default function KeywordReveal({
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
  const [busy, setBusy] = useState(false);
  const startTried = useRef(false);

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  // 안전망: 양 팀 모두 준비됐는데 아직 시작 안 됐으면 누구 폰이든 1라운드 시작 (멱등)
  const bothReady = white?.keywordReady === true && black?.keywordReady === true;
  useEffect(() => {
    if (!bothReady || room.phase !== "keyword_reveal") {
      startTried.current = false;
      return;
    }
    if (startTried.current) return;
    startTried.current = true;
    startFirstRoundIfReady(room.id).catch((e) => {
      startTried.current = false;
      console.error("startFirstRound error:", e);
    });
  }, [bothReady, room.id, room.phase]);

  if (!white || !black || !me?.team) {
    return (
      <Screen>
        <div className="p-6 text-sm text-muted">불러오는 중...</div>
      </Screen>
    );
  }

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const remaining = Math.max(0, 2 - myTeam.shuffleUsedCount);
  const myReady = myTeam.keywordReady;
  const notReady = (["white", "black"] as TeamId[]).filter(
    (t) => !(t === "white" ? white : black).keywordReady
  );

  const handleShuffle = async () => {
    if (remaining <= 0) return;
    setBusy(true);
    try {
      await shuffleTeamKeywords(room.id, myTeamId);
      toast.show("새 키워드를 받았어요", "success");
    } catch (e: any) {
      toast.show(e?.message || "다시 뽑기 실패", "error");
    }
    setBusy(false);
  };

  const handleReady = async () => {
    if (myReady) return;
    setBusy(true);
    try {
      await markTeamReady(room.id, myTeamId);
    } catch (e: any) {
      toast.show(e?.message || "준비 완료 처리 실패", "error");
    }
    setBusy(false);
  };

  return (
    <Screen>
      <StatusBar roundLabel="준비" white={white} black={black} />
      <MeLine teamId={myTeamId} teamName={myTeam.name} role="우리 팀 키워드 확인" />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <div>
          <h2 className="font-serif font-black text-[22px]">우리 팀 키워드</h2>
          <p className="text-[13px] text-muted mt-0.5">
            상대 팀에게 화면을 보여 주지 마세요. 게임 내내 그대로예요.
          </p>
        </div>
        <KeywordGrid keywords={myTeam.keywords} teamId={myTeamId} big />

        <Button variant="outline" className="w-full" onClick={handleShuffle} disabled={remaining <= 0 || myReady || busy}>
          <Shuffle className="w-4 h-4" />
          키워드 다시 뽑기 · 남은 횟수 {remaining}
        </Button>
        <p className="text-xs text-muted text-center">
          어색한 키워드가 있으면 팀이 의논해서 2번까지 다시 뽑을 수 있어요.
        </p>

        <div className="mt-auto flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={handleReady} disabled={myReady || busy}>
            <Check className="w-4 h-4" />
            {busy ? "보내는 중…" : myReady ? "준비 완료됨" : "우리 팀 준비 완료"}
          </Button>
          <WaitLine tone={notReady.length ? "red" : "ok"}>
            {notReady.length ? (
              <>
                기다리는 중:{" "}
                <b className="font-black">
                  {nameList(notReady.map((t) => (t === "white" ? white : black).name))}
                </b>
                {" "}준비
              </>
            ) : (
              "1라운드 시작하는 중…"
            )}
          </WaitLine>
        </div>
      </div>
    </Screen>
  );
}
