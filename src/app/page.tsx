"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ensureAnonymousAuth, joinRoom } from "@/lib/game";
import { BookOpen, Plus, Info } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 로컬에 저장된 닉네임 복원
    const saved = localStorage.getItem("nickname");
    if (saved) setNickname(saved);
  }, []);

  const handleCreate = () => {
    if (!nickname.trim()) {
      toast.show("닉네임을 입력해주세요", "error");
      return;
    }
    localStorage.setItem("nickname", nickname.trim());
    router.push("/create");
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      toast.show("닉네임을 입력해주세요", "error");
      return;
    }
    if (code.length !== 4) {
      toast.show("방 코드 4자리를 입력해주세요", "error");
      return;
    }
    localStorage.setItem("nickname", nickname.trim());
    setLoading(true);
    try {
      const user = await ensureAnonymousAuth();
      const roomId = await joinRoom(code, user.uid, nickname.trim());
      localStorage.setItem(`room:${roomId}`, "1");
      router.push(`/room/${roomId}`);
    } catch (e: any) {
      toast.show(e.message || "참가 실패", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        {/* 로고 */}
        <div className="text-center py-6">
          <div className="font-mono text-[28px] font-medium tracking-[0.15em] text-zinc-900">
            DECRYPTO
          </div>
          <div className="text-[13px] text-zinc-500 mt-1.5 tracking-wide">
            암호를 전송하라. 들키지 말고.
          </div>
        </div>

        {/* 닉네임 */}
        <div className="mb-4">
          <label className="block text-[13px] text-zinc-600 mb-1.5">닉네임</label>
          <Input
            placeholder="이름을 입력하세요"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            selectOnFocus
          />
        </div>

        {/* 방 만들기 */}
        <Button
          variant="outline"
          className="w-full mb-2"
          size="lg"
          onClick={handleCreate}
          disabled={loading}
        >
          <Plus className="w-4 h-4" />방 만들기
        </Button>

        {/* 방 참가 */}
        <div className="flex gap-1.5 mb-6">
          <Input
            placeholder="방 코드"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            className="font-mono tracking-[0.2em] text-center"
          />
          <Button onClick={handleJoin} disabled={loading} className="px-4 whitespace-nowrap">
            참가
          </Button>
        </div>

        <div className="border-t border-zinc-200 my-4" />

        <div className="flex flex-col gap-1">
          <button
            className="w-full py-2.5 text-[13px] text-zinc-600 hover:bg-zinc-50 rounded-lg text-left px-3 flex items-center gap-2"
            onClick={() => router.push("/rules")}
          >
            <BookOpen className="w-4 h-4" />게임 규칙 보기
          </button>
          <button
            className="w-full py-2.5 text-[13px] text-zinc-600 hover:bg-zinc-50 rounded-lg text-left px-3 flex items-center gap-2"
            onClick={() => router.push("/about")}
          >
            <Info className="w-4 h-4" />이 게임 소개
          </button>
        </div>
      </div>
    </div>
  );
}
