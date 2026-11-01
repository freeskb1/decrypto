"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ensureAnonymousAuth, createRoom } from "@/lib/game";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Screen, PageHead } from "@/components/game/ui";

export default function CreateRoom() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const nickname = localStorage.getItem("nickname");
    if (!nickname) {
      toast.show("닉네임이 없어요", "error");
      router.push("/");
      return;
    }
    setLoading(true);
    try {
      const user = await ensureAnonymousAuth();
      const { roomId } = await createRoom(user.uid, nickname);
      localStorage.setItem(`room:${roomId}`, "1");
      router.push(`/room/${roomId}`);
    } catch (e: any) {
      toast.show(e?.message || "방 만들기 실패", "error");
      setLoading(false);
    }
  };

  return (
    <Screen>
      <PageHead
        title="방 만들기"
        left={
          <button className="p-1 -ml-1" onClick={() => router.back()} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <div className="bg-wt text-wt-ink rounded-2xl px-4 py-3.5 text-[14px] leading-relaxed">
          <div className="font-serif font-black text-[18px] mb-1">같은 방에서, 각자 폰으로</div>
          4~8명이 모여 두 팀으로 나눠요. 화면에는 단서·답안·결과가 뜨고, 의논은 소리 내어 해요.
          같은 팀끼리 가까이 앉으면 좋아요.
        </div>
        <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3 text-[13px] text-muted leading-relaxed">
          방을 만들면 4자리 방 코드가 나와요. 친구들은 첫 화면에서 코드를 넣고 들어와요.
        </div>
        <div className="mt-auto">
          <Button className="w-full" size="lg" onClick={handleCreate} disabled={loading}>
            {loading ? "방 만드는 중..." : "방 만들기"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Screen>
  );
}
