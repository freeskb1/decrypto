"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <button className="p-1.5 hover:bg-zinc-100 rounded" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-medium">이 게임 소개</div>
        </div>

        <div className="space-y-3.5 text-[13px] text-zinc-700 leading-relaxed">
          <p>
            <strong>Decrypto</strong>는 Thomas Dagenais-Lespérance가 디자인한 보드게임입니다 (2018, Le Scorpion Masqué).
          </p>
          <p>
            이 웹 버전은 한국어 키워드로 친구들과 모바일에서 즐길 수 있게 만든 비상업 팬 메이드 프로젝트입니다.
          </p>
          <p className="text-zinc-500 text-xs">
            오리지널 보드게임을 즐기고 싶다면 정식 한국어판을 구매해보세요.
          </p>
        </div>
      </div>
    </div>
  );
}
