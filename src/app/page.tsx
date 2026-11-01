"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ensureAnonymousAuth, joinRoom } from "@/lib/game";
import { BookOpen, Plus, Info } from "lucide-react";
import { readHubParams, hubRoomId } from "@/lib/hub";
import { Screen } from "@/components/game/ui";

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [hubRedirecting, setHubRedirecting] = useState(false);

  useEffect(() => {
    // 말랑월드에서 넘어온 경우: 닉네임·방 만들기 화면을 건너뛰고 바로 대기실로
    // (쿼리는 그대로 넘겨서 방 화면이 sid/host를 읽게 함)
    const hub = readHubParams(window.location.search);
    if (hub) {
      setHubRedirecting(true);
      if (hub.name) localStorage.setItem("nickname", hub.name);
      router.replace(`/room/${hubRoomId(hub.room)}${window.location.search}`);
      return;
    }
    // 로컬에 저장된 닉네임 복원
    const saved = localStorage.getItem("nickname");
    if (saved) setNickname(saved);
  }, [router]);

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

  if (hubRedirecting) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          대기실로 이동하는 중...
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center gap-4 px-5 py-8">
        {/* 로고 */}
        <div className="text-center py-4">
          <div className="inline-block stamp-mark border-[3px] border-stamp text-stamp rounded-lg px-3 py-1 font-serif font-black text-[13px] mb-3">
            일급 비밀
          </div>
          <div className="font-mono font-bold text-[30px] tracking-[0.18em]">DECRYPTO</div>
          <div className="font-serif font-black text-[15px] text-muted mt-1">
            암호를 전송하라. 들키지 말고.
          </div>
        </div>

        <div className="bg-white border-[1.5px] border-line rounded-[20px] p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[13px] font-bold text-muted mb-1.5">닉네임</label>
            <Input
              placeholder="이름을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              selectOnFocus
            />
          </div>

          <Button size="lg" className="w-full" onClick={handleCreate} disabled={loading}>
            <Plus className="w-4 h-4" />방 만들기
          </Button>

          <div className="flex gap-1.5">
            <Input
              placeholder="방 코드 4자리"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              className="font-mono tracking-[0.2em] text-center"
            />
            <Button variant="outline" onClick={handleJoin} disabled={loading} className="px-5 whitespace-nowrap">
              참가
            </Button>
          </div>
          <p className="text-xs text-muted text-center">4~8명 · 같은 방에서 각자 폰으로 · 의논은 말로</p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => router.push("/rules")}>
            <BookOpen className="w-4 h-4" />게임 규칙
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => router.push("/about")}>
            <Info className="w-4 h-4" />이 게임 소개
          </Button>
        </div>
      </div>
    </Screen>
  );
}
