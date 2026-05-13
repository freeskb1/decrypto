"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ensureAnonymousAuth, createRoom } from "@/lib/game";
import { ArrowLeft, ArrowRight, MessagesSquare, Smartphone, Users, User } from "lucide-react";
import type { ConnectMode, GameMode } from "@/types/game";

export default function CreateRoom() {
  const router = useRouter();
  const toast = useToast();
  const [connectMode, setConnectMode] = useState<ConnectMode>("online");
  const [gameMode, setGameMode] = useState<GameMode>("standard");
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
      const { roomId } = await createRoom(user.uid, nickname, connectMode, gameMode);
      localStorage.setItem(`room:${roomId}`, "1");
      router.push(`/room/${roomId}`);
    } catch (e: any) {
      toast.show(e.message || "방 만들기 실패", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <button className="p-1.5" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-medium">방 만들기</div>
        </div>

        {/* 진행 방식 */}
        <div className="mb-5">
          <div className="text-[13px] text-zinc-600 mb-2">진행 방식</div>
          <ModeCard
            selected={connectMode === "online"}
            onClick={() => setConnectMode("online")}
            icon={<MessagesSquare className="w-5 h-5" />}
            title="온라인 (채팅)"
            desc="멀리 떨어진 팀원과 채팅으로 의논합니다"
          />
          <div className="h-2" />
          <ModeCard
            selected={connectMode === "offline"}
            onClick={() => setConnectMode("offline")}
            icon={<Smartphone className="w-5 h-5" />}
            title="오프라인 (만나서)"
            desc="팀당 폰 1대만 사용, 의논은 직접 대화"
          />
        </div>

        {/* 게임 모드 */}
        <div className="mb-5">
          <div className="text-[13px] text-zinc-600 mb-2">게임 모드</div>
          <ModeCard
            selected={gameMode === "standard"}
            onClick={() => setGameMode("standard")}
            icon={<Users className="w-5 h-5" />}
            title="표준"
            badge="팀당 2~4명"
            desc="원작 룰. 우리팀 추측 + 상대팀 가로채기"
          />
          <div className="h-2" />
          <ModeCard
            selected={gameMode === "duel"}
            onClick={() => setGameMode("duel")}
            icon={<User className="w-5 h-5" />}
            title="듀얼 (1대1)"
            badge="2인 전용"
            desc="상대 코드 가로채기만. 단순 버전"
          />
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? "방 만드는 중..." : "방 만들기"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl p-3.5 border transition-colors ${
        selected ? "border-blue-500 border-2" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-1">
        <span className={selected ? "text-blue-600" : "text-zinc-500"}>{icon}</span>
        <span className="text-sm font-medium">{title}</span>
        {badge && (
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded ${selected ? "bg-blue-50 text-blue-600" : "text-zinc-500"}`}>
            {selected ? "선택됨" : badge}
          </span>
        )}
        {!badge && selected && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600">
            선택됨
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-500 leading-relaxed pl-[30px]">{desc}</div>
    </button>
  );
}
