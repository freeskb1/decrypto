"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function RulesPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <button className="p-1.5 hover:bg-zinc-100 rounded" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-medium">게임 규칙</div>
        </div>

        <div className="space-y-4 text-[13px] text-zinc-700 leading-relaxed">
          <Section title="목표">
            <p>
              우리 팀끼리만 통하는 단서로 코드를 정확히 전달하고, 상대팀의 코드는 가로채세요.
            </p>
            <ul className="list-disc pl-5 mt-1.5 text-zinc-600">
              <li>가로채기 토큰 2개 = 승리</li>
              <li>통신실패 토큰 2개 = 패배</li>
              <li>8라운드 끝나면 토큰 많은 쪽 승리</li>
            </ul>
          </Section>

          <Section title="진행 방식">
            <p>각 팀은 비밀 키워드 4개를 받습니다 (게임 내내 고정).</p>
            <p className="mt-1.5">매 라운드:</p>
            <ol className="list-decimal pl-5 mt-1 text-zinc-600">
              <li>암호전달자가 3자리 코드(예: 4·2·1)를 받음</li>
              <li>각 자리에 해당하는 키워드의 단서를 작성</li>
              <li>팀원이 단서 보고 코드 추측 (성공 = 통신, 실패 = 통신실패 +1)</li>
              <li>상대팀도 단서 보고 가로채기 시도 (성공 = 가로채기 +1)</li>
            </ol>
          </Section>

          <Section title="단서 작성 금지">
            <ul className="list-disc pl-5 text-zinc-600">
              <li>철자/자모 힌트</li>
              <li>글자 수</li>
              <li>화면상 위치</li>
              <li>발음 유사어</li>
              <li>외국어 번역</li>
              <li>같은 단서 재사용 (자동 차단)</li>
            </ul>
          </Section>

          <Section title="듀얼 모드 (1대1)">
            <p>
              2명 전용. 통신실패 토큰 없음. 가로채기 2개 먼저 모으는 쪽이 승리.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium text-zinc-900 mb-1">{title}</div>
      {children}
    </div>
  );
}
