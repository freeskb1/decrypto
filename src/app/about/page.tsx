"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Screen, PageHead } from "@/components/game/ui";

export default function AboutPage() {
  const router = useRouter();
  return (
    <Screen>
      <PageHead
        title="이 게임 소개"
        left={
          <button className="p-1 -ml-1" onClick={() => router.back()} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-4 py-4">
        <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3.5 space-y-3 text-[14px] leading-relaxed">
          <p>
            <strong>Decrypto</strong>는 Thomas Dagenais-Lespérance가 디자인한 보드게임입니다 (2018, Le
            Scorpion Masqué).
          </p>
          <p>
            이 웹 버전은 한국어 키워드로 친구들과 같은 자리에서 각자 폰으로 즐길 수 있게 만든 비상업 팬 메이드
            프로젝트입니다.
          </p>
          <p className="text-muted text-xs">오리지널 보드게임을 즐기고 싶다면 정식 한국어판을 구매해보세요.</p>
        </div>
      </div>
    </Screen>
  );
}
