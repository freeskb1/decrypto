"use client";
import { useState } from "react";
import { Copy, Crown, Shuffle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { assignTeamsAndStart } from "@/lib/game";
import type { Room, Player } from "@/types/game";
import { MIN_PLAYERS, MAX_PLAYERS } from "@/types/game";
import { Screen, PageHead, WaitLine } from "./ui";

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
  const [busy, setBusy] = useState(false);
  const isHost = me?.isHost ?? false;
  const count = players.length;
  const tooFew = count < MIN_PLAYERS;
  const tooMany = count > MAX_PLAYERS;
  const host = players.find((p) => p.isHost);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      toast.show("코드를 복사했어요", "success");
    } catch {
      toast.show("복사 실패", "error");
    }
  };

  const handleAssign = async () => {
    if (tooFew || tooMany) return;
    setBusy(true);
    try {
      await assignTeamsAndStart(room.id);
    } catch (e: any) {
      toast.show(e?.message || "팀 배정 실패", "error");
    }
    setBusy(false);
  };

  return (
    <Screen>
      <PageHead
        title="대기실"
        left={
          room.hubSid ? undefined : (
            <button className="p-1 -ml-1" onClick={() => router.push("/")} aria-label="메인으로">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )
        }
        right={
          <span className="font-mono font-bold text-[13px] bg-ink text-paper rounded-md px-2 py-1">
            {count} / {MAX_PLAYERS}명
          </span>
        }
      />

      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        {!room.hubSid && (
          <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 flex items-center gap-3">
            <div>
              <div className="text-[11px] tracking-[0.2em] font-bold text-muted">방 코드</div>
              <div className="font-mono font-bold text-[30px] tracking-[0.2em] leading-tight">{room.code}</div>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={copyCode}>
              <Copy className="w-3.5 h-3.5" />
              복사
            </Button>
          </div>
        )}

        <div className="bg-white border-[1.5px] border-line rounded-2xl px-3 py-3">
          <div className="text-xs font-bold text-muted mb-2 px-1">모인 사람</div>
          <div className="grid grid-cols-2 gap-1.5">
            {players.map((p) => (
              <div key={p.uid} className="flex items-center gap-1.5 px-2.5 py-2 bg-paper rounded-xl">
                {p.isHost && <Crown className="w-3.5 h-3.5 text-stamp shrink-0" />}
                <span className="text-sm font-bold truncate">{p.nickname}</span>
                {p.uid === me?.uid && <span className="text-[11px] text-muted ml-auto">나</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-wt text-wt-ink rounded-2xl px-4 py-3 text-[13px] leading-relaxed">
          <b className="font-black">4~8명 · 같은 방에서 각자 폰으로</b>
          <br />
          의논은 소리 내어 해요 (채팅 없음). 방장이 팀을 무작위로 나눠요.
          {tooFew && (
            <>
              <br />
              <span className="font-bold text-stamp">
                {MIN_PLAYERS}명부터 시작할 수 있어요. 3명은 팀을 고르게 나눌 수 없어서 지원하지 않아요.
              </span>
            </>
          )}
          {tooMany && (
            <>
              <br />
              <span className="font-bold text-stamp">
                최대 {MAX_PLAYERS}명까지예요. {count - MAX_PLAYERS}명이 나가야 시작할 수 있어요.
              </span>
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {isHost ? (
            <Button size="lg" className="w-full" onClick={handleAssign} disabled={tooFew || tooMany || busy}>
              <Shuffle className="w-4 h-4" />
              {tooFew ? `${MIN_PLAYERS - count}명 더 필요해요` : "팀 랜덤 배정"}
            </Button>
          ) : (
            <WaitLine>
              기다리는 중: 방장 <b className="font-black">{host?.nickname || ""}</b>이 팀을 나누면 시작해요
            </WaitLine>
          )}
        </div>
      </div>
    </Screen>
  );
}
