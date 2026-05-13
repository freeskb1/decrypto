"use client";
import { Copy, Crown, Info, Shuffle, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { assignTeamsAndStart } from "@/lib/game";
import type { Room, Player } from "@/types/game";

export default function WaitingRoom({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const toast = useToast();
  const router = useRouter();
  const isHost = me?.isHost ?? false;
  const minPlayers = room.gameMode === "duel" ? 2 : 4;
  const enough = players.length >= minPlayers;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      toast.show("코드를 복사했어요", "success");
    } catch {
      toast.show("복사 실패", "error");
    }
  };

  const handleAssign = async () => {
    if (!enough) {
      toast.show(`최소 ${minPlayers}명 필요해요`, "error");
      return;
    }
    if (room.gameMode === "duel" && players.length !== 2) {
      toast.show("듀얼 모드는 2명만 가능해요", "error");
      return;
    }
    try {
      await assignTeamsAndStart(room.id);
    } catch (e: any) {
      toast.show(e.message || "팀 배정 실패", "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <button className="p-1.5" onClick={() => router.push("/")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-medium">대기실</div>
          <div className="ml-auto text-[11px] px-2 py-1 rounded bg-zinc-100 text-zinc-600">
            {room.connectMode === "online" ? "온라인" : "오프라인"} ·{" "}
            {room.gameMode === "standard" ? "표준" : "듀얼"}
          </div>
        </div>

        {/* 방 코드 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-5">
          <div className="text-[11px] text-zinc-500 mb-1">방 코드</div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-[26px] font-medium tracking-[0.2em]">
              {room.code}
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={copyCode}>
              <Copy className="w-3.5 h-3.5" />복사
            </Button>
          </div>
        </div>

        {/* 접속자 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <User className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium">접속자</span>
            <span className="ml-auto text-[11px] text-zinc-500">{players.length}명</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {players.map((p) => (
              <div
                key={p.uid}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-50 rounded-md"
              >
                {p.isHost ? (
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="text-[13px] truncate">{p.nickname}</span>
                {p.uid === me?.uid && (
                  <span className="text-[10px] text-zinc-400 ml-auto">나</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 안내 */}
        <div className="flex gap-2 p-2.5 bg-blue-50 rounded-md mb-3">
          <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 leading-relaxed">
            방장이 팀을 무작위로 배정합니다
          </div>
        </div>

        {/* 시작 버튼 */}
        {isHost ? (
          <Button
            className="w-full"
            size="lg"
            onClick={handleAssign}
            disabled={!enough}
          >
            <Shuffle className="w-4 h-4" />팀 랜덤 배정
          </Button>
        ) : (
          <div className="text-center text-xs text-zinc-400 py-3">
            방장이 시작하길 기다리는 중...
          </div>
        )}

        <div className="text-[11px] text-zinc-400 text-center mt-2">
          최소 {minPlayers}명이 모이면 시작할 수 있어요
        </div>
      </div>
    </div>
  );
}
