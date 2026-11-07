"use client";
import { Button } from "@/components/ui/button";
import { goToKeywordReveal } from "@/lib/game";
import type { Room, Player } from "@/types/game";
import { useToast } from "@/components/ui/toast";
import { ArrowRight } from "lucide-react";
import { Screen, PageHead } from "./ui";
import { ClueBanList } from "./RulesContent";

export default function RulesIntro({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const toast = useToast();
  // 누구든 넘길 수 있음 (방장 폰이 꺼져도 멈추지 않게)
  const handleNext = async () => {
    try {
      await goToKeywordReveal(room.id);
    } catch (e: any) {
      toast.show(e?.message || "넘기기 실패", "error");
    }
  };

  return (
    <Screen>
      <PageHead title="시작 전에" />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <div className="bg-bt text-bt-ink rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed">
          <div className="font-serif font-black text-[18px] mb-1">진행 순서</div>
          암호전달자 둘이 동시에 단서 3개 작성 (먼저 낸 쪽이 생기면 30초)
          <br />→ 두 팀 동시에 우리 팀 단서 해독
          <br />→ 두 팀 다 끝나면, 동시에 상대 팀 단서 가로채기
          <br />→ 두 팀 다 끝나면, 두 팀 결과 같이 공개
          <br />
          <span className="opacity-70">1라운드는 가로채기 없음 · 승패는 라운드가 끝날 때만 판정</span>
        </div>

        <div className="bg-wt text-wt-ink rounded-2xl px-4 py-3 text-[13px] font-bold">
          암호전달자는 단서를 낸 뒤 말하지 않아요. 표정도 조심!
        </div>

        <div className="text-xs font-bold text-muted px-1">
          이런 단서는 안 돼요 · 예: 우리 키워드가 <span className="font-mono text-ink">사과</span>일 때
        </div>
        <ClueBanList />

        <div className="mt-auto">
          <Button size="lg" className="w-full" onClick={handleNext}>
            확인했어요 · 키워드 보기 <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Screen>
  );
}
