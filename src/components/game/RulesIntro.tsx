"use client";
import { Button } from "@/components/ui/button";
import { goToKeywordReveal } from "@/lib/game";
import type { Room, Player } from "@/types/game";
import { useToast } from "@/components/ui/toast";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";

const FORBIDDEN = [
  { title: "철자·자모 힌트", example: '"ㅅ으로 시작" / "받침 없음"' },
  { title: "글자 수", example: '"두 글자" / "2"' },
  { title: "화면상 위치", example: '"삼총사" 로 3번 위치 키워드 암시' },
  { title: "발음 유사어", example: '"사고" 로 발음 비슷한 "사과" 암시' },
  { title: "외국어 번역", example: '"Apple" / "りんご"' },
  { title: "같은 단서 재사용", example: "한 번 쓴 단서는 게임 내내 다시 못 씁니다", badge: "자동 차단" },
];

export default function RulesIntro({
  room,
  me,
}: {
  room: Room;
  me: Player | undefined;
}) {
  const toast = useToast();
  const handleNext = async () => {
    if (!me?.isHost) {
      toast.show("방장만 진행할 수 있어요", "error");
      return;
    }
    await goToKeywordReveal(room.id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />단서 작성 규칙
          </div>
          <div className="text-[17px] font-medium mb-1">이런 단서는 안돼요</div>
          <div className="text-xs text-zinc-500">
            키워드 의미를 연상시키는 단서만 가능합니다
          </div>
        </div>

        <div className="text-[11px] text-zinc-400 mb-2 pl-1">
          예시 ㅡ 우리 팀 키워드가 <span className="font-mono text-zinc-900">사과</span> 일 때
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl py-1 mb-3">
          {FORBIDDEN.map((f, i) => (
            <div
              key={i}
              className={`px-3.5 py-2.5 ${i < FORBIDDEN.length - 1 ? "border-b border-zinc-200" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <X className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[13px] font-medium">{f.title}</span>
                {f.badge && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                    {f.badge}
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 pl-[22px]">{f.example}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl px-3.5 py-3 mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <Check className="w-3.5 h-3.5 text-green-600" />
            <span className="text-[13px] font-medium">가능한 단서 예시</span>
          </div>
          <div className="text-xs text-zinc-500 pl-[22px] leading-relaxed">
            "빨강", "과일", "뉴턴", "백설공주"
            <br />
            키워드의 의미·연상·관련 개념
          </div>
        </div>

        {me?.isHost ? (
          <Button className="w-full" size="lg" onClick={handleNext}>
            확인했어요 <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="text-center text-xs text-zinc-400 py-3">
            방장이 진행하길 기다리는 중...
          </div>
        )}
      </div>
    </div>
  );
}
