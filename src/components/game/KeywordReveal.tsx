"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  subscribeTeam,
  shuffleTeamKeywords,
  markTeamReady,
} from "@/lib/game";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { Check, Lock, Shuffle, Info } from "lucide-react";

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

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  if (!white || !black || !me?.team) {
    return <div className="p-4 text-sm text-zinc-400">불러오는 중...</div>;
  }

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const otherTeam = myTeamId === "white" ? black : white;
  const remaining = 2 - myTeam.shuffleUsedCount;
  const myReady = myTeam.keywordReady;
  const otherReady = otherTeam.keywordReady;

  const handleShuffle = async () => {
    if (remaining <= 0) {
      toast.show("이미 모두 사용했어요", "error");
      return;
    }
    try {
      await shuffleTeamKeywords(room.id, myTeamId);
      toast.show("새 키워드를 받았어요", "success");
    } catch (e: any) {
      toast.show(e.message || "셔플 실패", "error");
    }
  };

  const handleReady = async () => {
    if (myReady) return;
    await markTeamReady(room.id, myTeamId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-[11px] mb-2">
            <Lock className="w-3.5 h-3.5" />우리 팀 전용
          </div>
          <div className="text-[17px] font-medium mb-1">우리 팀 키워드</div>
          <div className="text-xs text-zinc-500">게임 내내 변하지 않습니다</div>
        </div>

        <div className="flex items-center gap-2 mb-3 px-1">
          <div className={`w-2 h-2 rounded-full ${myTeamId === "white" ? "bg-blue-500" : "bg-zinc-700"}`} />
          <span className="text-xs text-zinc-500">{myTeam.name}</span>
          <span className="ml-auto text-[11px] text-zinc-400">상대팀에겐 보이지 않음</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {myTeam.keywords.map((kw, i) => (
            <div
              key={i}
              className="bg-white border border-zinc-200 rounded-xl px-3 py-3.5"
            >
              <div className="font-mono text-[11px] text-zinc-400 mb-1.5">
                [ {i + 1} ]
              </div>
              <div className="text-[18px] font-medium">{kw}</div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full mb-3"
          onClick={handleShuffle}
          disabled={remaining <= 0 || myReady}
        >
          <Shuffle className="w-4 h-4" />키워드 다시 뽑기
          <span className="text-[11px] text-zinc-400 ml-1">남은 횟수 {remaining}</span>
        </Button>

        <div className="flex gap-2 p-2.5 bg-blue-50 rounded-md mb-5">
          <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 leading-relaxed">
            키워드가 어색하면 최대 2번까지 다시 뽑을 수 있어요. 시작 후엔 바꿀 수 없습니다.
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleReady}
          disabled={myReady}
        >
          <Check className="w-4 h-4" />{myReady ? "준비 완료됨" : "준비 완료"}
        </Button>

        <div className="flex gap-1.5 mt-3">
          <ReadyBadge
            teamName={white.name}
            ready={white.keywordReady}
            color="bg-blue-500"
          />
          <ReadyBadge
            teamName={black.name}
            ready={black.keywordReady}
            color="bg-zinc-700"
          />
        </div>
      </div>
    </div>
  );
}

function ReadyBadge({
  teamName,
  ready,
  color,
}: {
  teamName: string;
  ready: boolean;
  color: string;
}) {
  return (
    <div className="flex-1 px-2.5 py-2 bg-white border border-zinc-200 rounded-md flex items-center gap-1.5 text-[11px]">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-zinc-500 truncate">{teamName}</span>
      <span className={`ml-auto ${ready ? "text-green-600" : "text-zinc-400"}`}>
        {ready ? "완료" : "대기 중"}
      </span>
    </div>
  );
}
